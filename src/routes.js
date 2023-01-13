const { Router } = require('express');
const { root } = require('./controller');
// const { limiter } = require('./queue-limit.middleware');
const { limiter } = require('./concurrency-limit.middleware');

const router = new Router();

router.use(limiter);

router.get('/', root);

module.exports = { router };
