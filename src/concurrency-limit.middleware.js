const { nanoid } = require('nanoid');
const { connect } = require('./redis');
const { TimeOutError, QueueMaxSizeError, timeOutPromise } = require('./utils');
const { Limiter } = require('./rateLimiter');

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
        await limiterInstance.removeFromSet(requestId);
        limiterInstance.removeFromLocalQueue();
      } catch (error) {
        console.log(error);
      } finally {
        console.log('resolved', requestId);
        return next();
      }
    });

    return next();
  } catch (error) {
    console.log(error);
    if (error instanceof QueueMaxSizeError) {
      return res.status(429).send(error);
    }

    return res.status(500).send(error);
  }
};

module.exports = { limiter };
