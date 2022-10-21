function asyncAction(promise) {
  return Promise.resolve(promise)
    .then((data) => [null, data])
    .catch((error) => [error]);
}

module.exports = { asyncAction };
