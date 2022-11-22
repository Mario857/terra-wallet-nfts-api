const { uniqBy } = require("lodash");
const { CHAIN_ID } = require("./config");

const CACHE_KEY = `${CHAIN_ID}_cw721_contracts`;

const META_CACHE_KEY = `${CHAIN_ID}_cw721_meta`;

const defaultCw721Data = {
  lastOffset: 1,
  data: [],
};

const defaultCw721Meta = {
  data: [],
};

async function getCw721sContractsData(redisClient) {
  const data = await redisClient.get(CACHE_KEY);

  if (!data) {
    await redisClient.set(CACHE_KEY, JSON.stringify(defaultCw721Data));

    return defaultCw721Data;
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

async function getCw721Metadata(redisClient, contractAddress) {
  const data = await redisClient.get(`${META_CACHE_KEY}_${contractAddress}`);

  if (!data) {
    await redisClient.set(`${META_CACHE_KEY}_${contractAddress}`, JSON.stringify(defaultCw721Meta));

    return defaultCw721Meta;
  }

  return JSON.parse(data);
}

async function appendCw721sMetadata(redisClient, contractAddress, data) {
  const oldData = await getCw721Metadata(redisClient);

  const newData = {
    data: uniqBy([...oldData.data, ...data], (data) => data.tokenId),
  };

  await redisClient.set(`${META_CACHE_KEY}_${contractAddress}`, JSON.stringify(newData));
}

module.exports = {
  appendCw721sContractsData,
  getCw721sContractsData,
  appendCw721sMetadata,
  getCw721Metadata,
};
