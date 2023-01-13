class TimeOutError extends Error {
  constructor(message) {
    super(message);
  }
}

class QueueMaxSizeError extends Error {
  constructor(message) {
    super(message);
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

module.exports = {
  delay,
  timeOutPromise,
  TimeOutError,
  QueueMaxSizeError,
};
