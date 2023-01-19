const expireOldRequestLuaScript = `local current_time = redis.call("TIME") \
local removed = redis.call('zremrangebyscore', KEYS[1], '-inf', current_time[1]) \
local current = redis.call('zcard', KEYS[1]) \
return {removed, current} \
`;

class TimeOutError extends Error {
  constructor(message) {
    super(message);
  }
}

class QueueMaxSizeError extends Error {
  constructor(message) {
    super(message);
  }
}

const POLLING_INTERVAL = 1000;
const EXPIRATION_CHECK_INTERVAL = 1000 * 5;

class Limiter {
  constructor({
    prefixKey,
    requestAmount,
    maxQueueSize,
    redisClient,
    maxProcessingTime = 1000 * 60 * 3, // 3 Minutes
    expirationTimeSetItems = 1000 * 5, // 5 Seconds
    logger = console,
    debug = false,
  }) {
    this.prefixKey = prefixKey;
    this.requestAmount = requestAmount;
    this.maxQueueSize = maxQueueSize;
    this.redisClient = redisClient;
    this.localQueue = new Set();
    this.requestSetKey = `${prefixKey}:requests`;
    this.maxProcessingTime = maxProcessingTime;
    this.expirationTimeSetItems = expirationTimeSetItems + maxProcessingTime;
    this.nextExpirationCall = Date.now() + EXPIRATION_CHECK_INTERVAL;
    this.logger = logger;
    this.debug = debug;
  }

  async handle(requestId) {
    await this.expireOldItemsInSet();
    const numberOfRequests = await this.getNumberOfRequestRunning();

    if (numberOfRequests > this.requestAmount) {
      if (this.localQueue.size < this.maxQueueSize) {
        // If the set is full push to the queue and start a timeout
        this.pushToLocalQueue(requestId);

        this.debug &&
          this.logger.info(
            'RateLimiter Queued',
            requestId,
            this.localQueue.size,
            this.localQueue
          );

        // Ask if the request can be handled and reject when timeOut
        return this.checkIfCanHandle(requestId);
      } else {
        // if the queue is full return 429
        throw new QueueMaxSizeError('QUEUE_SIZE_REACHED');
      }
    }

    // If no limit reached then push to the set and resolve inmediatly
    return this.pushToSet(requestId);
  }

  free(requestId) {
    this.debug && this.logger.info('RateLimiter Finished', requestId);
    this.removeFromLocalQueue(requestId);
    return this.removeFromSet(requestId);
  }

  getNumberOfRequestRunning() {
    return this.redisClient.zcardAsync(this.requestSetKey);
  }

  pushToSet(requestId) {
    this.debug && this.logger.info('RateLimiter Added', requestId);
    return this.redisClient.zaddAsync(
      this.requestSetKey,
      Date.now() + this.expirationTimeSetItems,
      requestId
    );
  }

  removeFromSet(requestId) {
    return this.redisClient.zremAsync(this.requestSetKey, requestId);
  }

  pushToLocalQueue(requestId) {
    this.localQueue.add(requestId);
  }

  removeFromLocalQueue(requestId) {
    this.localQueue.delete(requestId);
  }

  checkIfCanHandle(requestId) {
    return new Promise((resolve, reject) => {
      const intervalId = setInterval(() => {
        (async () => {
          try {
            const numberOfRequests = await this.getNumberOfRequestRunning();
            if (numberOfRequests < this.requestAmount) {
              this.removeFromLocalQueue(requestId);
              await this.pushToSet(requestId);
              clearInterval(intervalId);
              return resolve(requestId);
            }
          } catch (error) {
            this.debug && console.log(error);
            clearInterval(intervalId);
            return reject(error);
          }
        })();
      }, POLLING_INTERVAL);

      setTimeout(() => {
        clearInterval(intervalId);
        return reject(new TimeOutError('REQUEST_TIMED_OUT'));
      }, this.maxProcessingTime);
    });
  }

  expireOldItemsInSet() {
    if (Date.now() >= this.nextExpirationCall) {
      this.nextExpirationCall = Date.now() + EXPIRATION_CHECK_INTERVAL;

      return expireOldRequests(this.redisClient, `${this.prefixKey}:requests`);
    }
    return;
  }
}

const expireOldRequests = function (redisClient, prefixKey) {
  return redisClient.evalAsync(
    expireOldRequestLuaScript,
    1,
    `${prefixKey}:requests`
  );
};

module.exports = {
  Limiter,
  TimeOutError,
  QueueMaxSizeError,
  expireOldRequests,
  expireOldRequestLuaScript,
};
