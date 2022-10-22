const CACHE_PREFIX = "testnet";

const CACHE_KEY = `${CACHE_PREFIX}_cw721_contracts`;
const INTERACTED_CONTRACTS_PREFIX = `${CACHE_PREFIX}_interacted_cw721_contracts`;

const defaultData = {
  lastOffset: 1,
  data: [],
};

async function getCw721sContractsData(redisClient) {
  const data = await redisClient.get(CACHE_KEY);

  if (!data) {
    await redisClient.set(CACHE_KEY, JSON.stringify(defaultData));

    return defaultData;
  }

  return JSON.parse(data);
}

async function appendCw721sContractsData(redisClient, data) {
  const oldData = await getCw721sContractsData(redisClient);

  const newData = {
    lastOffset: data.lastOffset,
    data: [...new Set([...oldData.data, ...data.data])],
  };

  await redisClient.set(CACHE_KEY, JSON.stringify(newData));
}

async function getInteractedCw721Contract(redisClient, userAddress) {
  const data = await redisClient.get(CACHE_KEY);

  if (!data) {
    await redisClient.set(`${INTERACTED_CONTRACTS_PREFIX}_${userAddress}`, JSON.stringify(defaultData));

    return defaultData;
  }

  return JSON.parse(data);
}

async function appendInteractedCw721sData(redisClient, userAddress, data) {
  const oldData = await getInteractedCw721Contract(redisClient, userAddress);

  const newData = {
    lastOffset: data.lastOffset,
    data: [...new Set([...oldData.data, ...data.data])],
  };

  await redisClient.set(`${INTERACTED_CONTRACTS_PREFIX}_${userAddress}`, JSON.stringify(newData));
}

module.exports = {
  appendCw721sContractsData,
  getCw721sContractsData,
  appendInteractedCw721sData,
  getInteractedCw721Contract,
};
