const { nanoid } = require('nanoid');
const { connect } = require('./redis');
const { TimeOutError, QueueMaxSizeError, timeOutPromise } = require('./utils');
const { Limiter } = require('./RateLimiter');

const requestAmount = 1;
const maxQueueSize = 1;
let limiterInstance;

const limiter = async (req, res, next) => {
  const requestId = nanoid();
  const { clientId } = req.query;
  req.id = requestId;

  // const baseKey = `limiter:${clientId}`;
  const baseKey = `limiter`;
  console.log('Received', requestId);
  try {
    const redis = await connect();
    // await
    if (!limiterInstance) {
      limiterInstance = new Limiter({
        baseKey,
        requestAmount,
        maxQueueSize,
        redisClient: redis,
      });
    }

    await limiterInstance.handle(requestId);

    res.on('finish', async () => {
      try {
        await limiterInstance.free(requestId);
      } catch (error) {
        console.log(error);
      } finally {
        console.log('resolved', requestId);
        return next();
      }
    });

    return next();
  } catch (error) {
    if (error instanceof QueueMaxSizeError) {
      return res.status(429).send(error);
    }

    if (error instanceof TimeOutError) {
      return res.status(504).send(error);
    }

    return res.status(500).send(error);
  }
};

module.exports = { limiter };
