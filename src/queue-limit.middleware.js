const { nanoid } = require('nanoid');
const { RateLimiterRedis, RateLimiterQueue } = require('rate-limiter-flexible');
const RateLimiterQueueError = require('rate-limiter-flexible/lib/component/RateLimiterQueueError');
const { connect } = require('./redis');
const { TimeOutError, timeOutPromise } = require('./utils');

let limiters = {};

const getLimiter = async ({
  clientId,
  points,
  duration,
  storeClient,
  maxQueueSize = null,
}) => {
  // TODO: Get limits per client from mongo or other store
  const clientLimiters = limiters[clientId];

  if (!clientLimiters) {
    const redisLimiter = new RateLimiterRedis({
      storeClient,
      // keyPrefix: `limiter-redis:${clientId}`,
      points,
      duration, // Per seconds
    });

    const queueOpts = maxQueueSize ? { maxQueueSize } : {};

    const queueLimiter = new RateLimiterQueue(redisLimiter, queueOpts);

    limiters[clientId] = { redisLimiter, queueLimiter };
  }

  return limiters[clientId];
};

const TTL_QUEUED_REQUEST = 60 * 1000;

const limiter = async (req, res, next) => {
  const requestId = nanoid();
  const { clientId } = req.query;
  req.id = requestId;
  try {
    const redis = await connect();
    console.log('Received:', clientId, requestId, Date.now());
    const { queueLimiter } = await getLimiter({
      clientId,
      points: 10,
      duration: 60 * 2,
      storeClient: redis,
      maxQueueSize,
    });

    await timeOutPromise(
      TTL_QUEUED_REQUEST, // ms
      queueLimiter.removeTokens(1, clientId)
    );
    console.log('Resolved:', clientId, requestId, Date.now());
    return next();
  } catch (error) {
    // Throw when a queued request took more to resolve than the TTL
    if (error instanceof TimeOutError) {
      return res.status(504).send(error);
    }

    if (error instanceof RateLimiterQueueError) {
      return res.status(429).send(error);
    }

    return res.status(500).send(error);
  }
};

module.exports = { limiter };
