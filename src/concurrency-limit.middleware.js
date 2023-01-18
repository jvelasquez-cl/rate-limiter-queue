const { nanoid } = require('nanoid');
const { connect } = require('./redis');
const { Limiter, TimeOutError, QueueMaxSizeError } = require('./RateLimiter');

const requestAmount = 5;
const maxQueueSize = 20;
let limiterInstance;

const limiter = async (req, res, next) => {
  // const requestId = nanoid();
  const { clientId } = req.query;
  let requestId;

  // const baseKey = `limiter:${clientId}`;
  const baseKey = `limiter`;
  // console.log('Received', requestId);
  try {
    const redis = await connect();
    requestId = await redis.incrAsync(`${baseKey}:counter`);
    req.id = requestId;
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
        // console.log('resolved', requestId);
        return next();
      }
    });

    return next();
  } catch (error) {
    await limiterInstance.free(requestId);
    console.log('Error', requestId, error.message);
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
