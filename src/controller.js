const { delay } = require('./utils');

const root = async (req, res) => {
  // console.log('Controller', req.id);
  await delay(3000);
  return res.status(200).json({});
};

module.exports = { root };
