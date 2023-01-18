const { nanoid } = require('nanoid');
const logger = require('@condor-labs/logger');
const { connect } = require('../libs/redis');
const { Limiter, TimeOutError, QueueMaxSizeError } = require('./RateLimiter');

const requestAmount = 5;
const maxQueueSize = 20;
let limiterInstance;

const ConcurrencyLimiter = async (req, res, next) => {
  let requestId;

  const prefixKey = `limiter`;
  try {
    const redis = await connect();
    // This can throw if reach the limit. The limit is a trillion, but aja. nanoid could be a better option.
    requestId = await redis.incrAsync(`${prefixKey}:counter`);
    req.id = requestId;

    if (!limiterInstance) {
      limiterInstance = new Limiter({
        prefixKey,
        requestAmount,
        maxQueueSize,
        redisClient: redis,
        // logger,
        debug: true,
      });
    }

    await limiterInstance.handle(requestId);

    res.on('finish', async () => {
      try {
        await limiterInstance.free(requestId);
      } catch (error) {
        console.log(error);
      } finally {
        return next();
      }
    });

    return next();
  } catch (error) {
    await limiterInstance.free(requestId); // Check if this is needed because when a request finish the free method is called is called
    logger.error('Error', requestId, error.message);
    if (error instanceof QueueMaxSizeError) {
      return res.status(429).send(error);
    }

    if (error instanceof TimeOutError) {
      return res.status(504).send(error);
    }

    return res.status(500).send(error);
  }
};

module.exports = { ConcurrencyLimiter };
