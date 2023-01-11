const port = 3000;
const app = require('./src/app');
const { connect } = require('./src/redis');

const start = async () => {
  // await connect();

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
};

start();
