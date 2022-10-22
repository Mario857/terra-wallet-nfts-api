const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));
const { last } = require("lodash");
const { asyncAction } = require("./asyncAction");
const { getNFTInfoCached } = require("./cache");
const { keysToCamel } = require("./keysToCamel");

async function queryUserTokensUntilEnd(lcdClient, contractAddress, walletAddress) {
  let startAfter = undefined;
  const results = [];

  do {
    const [, usersTokens] = await asyncAction(
      lcdClient.wasm.contractQuery(contractAddress, {
        tokens: {
          owner: walletAddress,
          limit: 30,
          start_after: startAfter,
        },
      })
    );

    const tokens = usersTokens?.tokens?.length ? usersTokens?.tokens : usersTokens.ids;

    startAfter = last(tokens);

    results.push(tokens);
  } while (startAfter);

  return results.flat().filter((x) => x);
}

async function queryWalletNFTs(lcdClient, redisClient, cw721s, walletAddress) {
  const usersCw721s = await pMap(
    cw721s,
    async (contractAddress) => {
      const usersTokens = await queryUserTokensUntilEnd(lcdClient, contractAddress, walletAddress);

      if (usersTokens) {
        return pMap(usersTokens, async (tokenId) => getNFTInfoCached(lcdClient, redisClient, contractAddress, tokenId));
      }
    },
    { concurrency: 30 }
  );

  return keysToCamel(usersCw721s);
}

module.exports = { queryWalletNFTs };
