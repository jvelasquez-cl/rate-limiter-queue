const { delay } = require('./utils');

const root = async (req, res) => {
  await delay(1000 * 3);
  return res.status(200).json({});
};

module.exports = { root };
