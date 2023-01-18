const { Router } = require('express');
const { root } = require('./controller');
const {
  ConcurrencyLimiter,
} = require('./ConcurrencyLimiter/ConcurrencyLimiter.middleware');

const router = new Router();

router.use(ConcurrencyLimiter);

router.get('/', root);

module.exports = { router };
