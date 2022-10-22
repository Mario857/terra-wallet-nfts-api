const CACHE_KEY = "testnet_cw721_contracts";

const defaultData = {
  lastOffset: 1,
  data: [],
};

async function getContractsData(redisClient) {
  const data = await redisClient.get(CACHE_KEY);

  if (!data) {
    await redisClient.set(CACHE_KEY, JSON.stringify(defaultData));

    return defaultData;
  }

  return JSON.parse(data);
}

async function appendContractsData(redisClient, data) {
  const oldData = await getContractsData(redisClient);

  const newData = {
    lastOffset: data.lastOffset,
    data: [...new Set([...oldData.data, ...data.data])],
  };

  await redisClient.set(CACHE_KEY, JSON.stringify(newData));
}

module.exports = { getContractsData, appendContractsData };
