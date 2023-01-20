function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function timeOutPromise(time, promise) {
  const timer = new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${time} ms.`)), time);
  });

  return Promise.race([timer, promise]);
}

module.exports = {
  delay,
  timeOutPromise,
};
