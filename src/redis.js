const redisClient = require('@condor-labs/redis');
let redisInstance;

const connect = async () => {
  if (!redisInstance) {
    redisInstance = await redisClient({ host: 'localhost' }).getClient();
  }
  return redisInstance;
};

const getClient = () => {
  return redisInstance;
};

module.exports = { connect, getClient };
