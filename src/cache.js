const { uniqBy } = require("lodash");
const { CHAIN_ID } = require("./config");

const CACHE_KEY = `${CHAIN_ID}_cw721_contracts`;

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
    data: uniqBy([...oldData.data, ...data.data], (data) => data.contractAddress),
  };

  await redisClient.set(CACHE_KEY, JSON.stringify(newData));
}

module.exports = {
  appendCw721sContractsData,
  getCw721sContractsData,
};
