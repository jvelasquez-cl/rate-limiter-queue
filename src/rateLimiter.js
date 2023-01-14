const {
  QueueMaxSizeError,
  timeOutPromise,
  delay,
  TimeOutError,
} = require('./utils');

/*
  TODO:
    - Set an expiration time to the items in the redis set
    - Check the checkIfCanHandle while to exit
*/

class Limiter {
  constructor({ baseKey, requestAmount, maxQueueSize, redisClient }) {
    this.baseKey = baseKey;
    this.requestAmount = requestAmount;
    this.maxQueueSize = maxQueueSize;
    this.redisClient = redisClient;
    this.localQueue = new Map();
    this.requestSetKey = `${baseKey}:requests`;
  }

  async handle(requestId) {
    const numberOfRequests = await this.getNumberOfRequestRunning();

    if (numberOfRequests > this.requestAmount) {
      if (this.localQueue.size < this.maxQueueSize) {
        // if the set is full push to the queue and start a timeout
        this.pushToLocalQueue(requestId);

        // Ask if the request can be handled and reject when timeOut
        console.log('Queued');
        // await timeOutPromise(3000, this.checkIfCanHandle(requestId));

        return this.checkIfCanHandle(requestId);
      } else {
        // if the queue is full return 429
        throw new QueueMaxSizeError('Queue size reached');
      }
    }

    // if no limit reached then push to the set and resolve inmediatly
    await this.pushToSet(requestId);
  }

  free(requestId) {
    this.removeFromLocalQueue(requestId);
    return this.removeFromSet(requestId);
  }

  getNumberOfRequestRunning() {
    return this.redisClient.zcardAsync(this.requestSetKey);
  }

  pushToSet(requestId) {
    return this.redisClient.zaddAsync(
      this.requestSetKey,
      Date.now(),
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
              return resolve(requestId);
            }
          } catch (error) {
            return reject(error);
          }
        })();
      }, 200);

      setTimeout(() => {
        clearInterval(intervalId);
        return reject(
          new TimeOutError('Request timedout waiting in the queue')
        );
      }, 1000);
    });
  }
}

module.exports = { Limiter };
