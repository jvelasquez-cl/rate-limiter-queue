const { Router } = require('express');
const { handler: timeoutMiddleware } = require('express-timeout-handler');
const { root } = require('./controller');
const {
  ConcurrencyLimiter,
} = require('./ConcurrencyLimiter/ConcurrencyLimiter.middleware');

const router = new Router();

router.use(
  timeoutMiddleware({
    timeout: 1000,
    onTimeout: (_req, res) => {
      return res.status(504).send('REQUEST_TIMED_OUT');
    },
  })
);

router.use(ConcurrencyLimiter);

router.get('/', root);

module.exports = { router };
