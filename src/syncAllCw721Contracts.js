const { isNil } = require("lodash");
const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));
const { asyncAction } = require("./asyncAction");
const { parseTxResult } = require("./parseTxResult");
const promiseRetry = require("promise-retry");
const { getCw721sContractsData, appendCw721sContractsData } = require("./cache");

async function syncAllCw721Contracts(lcdClient, redisClient) {
  console.log("[syncAllCw721Contracts]: API starts fetching cw721Contracts");

  const cachedData = await getCw721sContractsData(redisClient);

  console.log(`[syncAllCw721Contracts]: Starting offset ${cachedData.lastOffset}`);

  let result = [];
  let hasMore = false;
  let perPage = 100;

  const interactedContractsQuery = {
    events: [{ key: "message.action", value: "/cosmwasm.wasm.v1.MsgInstantiateContract" }],
  };

  let page = cachedData.lastOffset;

  do {
    const [error, data] = await asyncAction(
      promiseRetry({ minTimeout: 250, retries: 50, factor: 1.85, randomize: true }, (retry) =>
        lcdClient.tx
          .search({
            "pagination.offset": page,
            "pagination.limit": perPage,
            ...interactedContractsQuery,
          })
          .catch(retry)
      )
    );

    if (error) {
      console.warn(error);
      hasMore = false;
    }

    if (data) {
      const lastPage = page;
      console.warn(data.pagination);
      hasMore = !(data.txs.length < perPage);

      page += data.txs.length;
      // Tx hashes you can search in Terra Finder, or anything else replace here
      result.push(data.txs.flatMap((x) => parseTxResult(x)));

      const cw721s = await pMap(
        data.txs.flatMap((x) => parseTxResult(x)).map(({ ContractAddress }) => ContractAddress),
        async (contractAddress) => {
          const [error, result] = await asyncAction(
            lcdClient.wasm.contractQuery(contractAddress, {
              num_tokens: {},
            })
          );

          if (error) {
            let errorMessage = error?.response?.data?.message ?? "";

            if (!errorMessage.includes("unknown variant") && !errorMessage.includes("invalid request")) {
              console.log(errorMessage ?? "");
            }
          }
          if (!isNil(result) && result?.count) {
            return contractAddress;
          }

          return null;
        },
        { concurrency: 30 }
      );

      const parsedCw721 = cw721s.filter((x) => x);

      await appendCw721sContractsData(redisClient, {
        lastOffset: lastPage,
        data: parsedCw721,
      });

      result.push(parsedCw721);
    }
  } while (hasMore);

  console.log("[syncAllCw721Contracts]: API fetched cw721Contracts");

  return [result.flat()];
}

module.exports = { syncAllCw721Contracts };
