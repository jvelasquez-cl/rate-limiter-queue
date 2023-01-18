const expireOldRequestLuaScript = `local current_time = redis.call("TIME") \
local removed = redis.call('zremrangebyscore', KEYS[1], '-inf', current_time[1]) \
local current = redis.call('zcard', KEYS[1]) \
return {removed, current} \
`;

/*
  TODO:
    - Set an expiration time to the items in the redis set using node-cache to control
    the number of script execution per instance 5s TTL.
    - Check if the check of the set can be made with a lua script
*/

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

class Limiter {
  constructor({
    prefixKey,
    requestAmount,
    maxQueueSize,
    redisClient,
    maxWaitingTimeInQueue = 1000 * 60 * 3, // 3 Minutes
    pollingInterval = 1000, // Every second
    expirationTimeSetItems = 1000 * 60 * 10, // 10 Minutes
    expirationCheckInterval = 1000 * 60 * 5, // 5 Minutes
  }) {
    this.prefixKey = prefixKey;
    this.requestAmount = requestAmount;
    this.maxQueueSize = maxQueueSize;
    this.redisClient = redisClient;
    this.localQueue = new Map();
    this.requestSetKey = `${prefixKey}:requests`;
    this.maxWaitingTimeInQueue = maxWaitingTimeInQueue;
    this.pollingInterval = pollingInterval;
    this.expirationTimeSetItems = expirationTimeSetItems;
    this.expirationCheckInterval = expirationCheckInterval;
    this.nextExpirationCall = Date.now() + expirationCheckInterval;
  }

  async handle(requestId) {
    await this.expireOldItemsInSet();
    const numberOfRequests = await this.getNumberOfRequestRunning();

    if (numberOfRequests > this.requestAmount) {
      if (this.localQueue.size < this.maxQueueSize) {
        // if the set is full push to the queue and start a timeout
        this.pushToLocalQueue(requestId);

        // Ask if the request can be handled and reject when timeOut
        console.log('Queued', requestId, this.localQueue.size, this.localQueue);
        // await timeOutPromise(3000, this.checkIfCanHandle(requestId));

        return this.checkIfCanHandle(requestId);
      } else {
        // if the queue is full return 429
        throw new QueueMaxSizeError('Queue size reached');
      }
    }

    // if no limit reached then push to the set and resolve inmediatly
    return this.pushToSet(requestId);
  }

  free(requestId) {
    console.log('Finished', requestId);
    this.removeFromLocalQueue(requestId);
    return this.removeFromSet(requestId);
  }

  getNumberOfRequestRunning() {
    return this.redisClient.zcardAsync(this.requestSetKey);
  }

  pushToSet(requestId) {
    console.log('Added', requestId);
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
    this.localQueue.set(requestId, true);
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
            console.log(error);
            clearInterval(intervalId);
            return reject(error);
          }
        })();
      }, this.pollingInterval);

      setTimeout(() => {
        clearInterval(intervalId);
        return reject(
          new TimeOutError('Request timedout waiting in the queue')
        );
      }, this.maxWaitingTimeInQueue);
    });
  }

  expireOldItemsInSet() {
    if (Date.now() >= this.nextExpirationCall) {
      this.nextExpirationCall = Date.now() + this.expirationCheckInterval;
      return expireOldRequests(this.redisClient, `${this.prefixKey}:requests`);
    }
    return;
  }
}

const expireOldRequests = (redisClient, prefixKey) => {
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
};
