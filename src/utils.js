class TimeOutError extends Error {
  constructor(args) {
    super(args);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function timeOutPromise(time, promise) {
  const timer = new Promise((_resolve, reject) => {
    setTimeout(
      () => reject(new TimeOutError(`Timed out after ${time} ms.`)),
      time
    );
  });

  return Promise.race([timer, promise]);
}

module.exports = { delay, timeOutPromise, TimeOutError };
