const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));
const { last } = require("lodash");
const { asyncAction } = require("./asyncAction");
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

async function queryWalletNFTs(lcdClient, cw721s, walletAddress) {
  const usersCw721s = await pMap(
    cw721s,
    async (contractAddress) => {
      const usersTokens = await queryUserTokensUntilEnd(lcdClient, contractAddress, walletAddress);

      if (usersTokens) {
        return pMap(usersTokens, async (tokenId) => {
          const [error, info] = await asyncAction(
            lcdClient.wasm.contractQuery(contractAddress, {
              all_nft_info: {
                token_id: tokenId,
              },
            })
          );

          if (error) {
            console.log(error);
          }

          if (info) {
            return {
              contractAddress,
              ...info?.info,
            };
          }

          return null;
        });
      }
    },
    { concurrency: 30 }
  );

  return keysToCamel(usersCw721s);
}

module.exports = { queryWalletNFTs };
