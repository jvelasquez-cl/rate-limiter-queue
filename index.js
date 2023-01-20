const port = 3000;
const app = require('./src/app');
const { connect } = require('./src/libs/redis');
const { expireOldRequests } = require('./src/ConcurrencyLimiter/RateLimiter');

const start = async () => {
  const redis = await connect();

  const [_removed, _current] = await expireOldRequests(redis, 'limiter');

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
};

start();
