const { isNil, compact } = require("lodash");
const { asyncAction } = require("./asyncAction");
const { parseInitializedContractTxResult } = require("./parseTxResult");
const promiseRetry = require("promise-retry");
const { getCw721sContractsData, appendCw721sContractsData } = require("./cache");
const { batchContractQuery } = require("./wasm");

async function syncAllInitializedCw721Contracts(lcdClient, redisClient) {
  console.log("[getAllInitializedCw721Contracts]: API starts fetching initialized");

  const cachedData = await getCw721sContractsData(redisClient);

  console.log(`[getAllInitializedCw721Contracts]: Starting offset ${cachedData.lastOffset}`);

  let hasMore = false;
  let perPage = 100;
  let lastPage = cachedData.lastOffset;

  const interactedContractsQuery = {
    events: [{ key: "message.action", value: "/cosmwasm.wasm.v1.MsgInstantiateContract" }],
  };

  let page = lastPage;

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
      lastPage = page;
      console.warn(data.pagination);
      hasMore = !(data.txs.length < perPage);

      page += data.txs.length;

      const contractAddresses = data.txs
        .flatMap((x) => parseInitializedContractTxResult(x))
        .map(({ ContractAddress }) => ContractAddress);

      const cw721s = await batchContractQuery(
        contractAddresses.map((contractAddress) => ({
          contractAddress,
          query: { num_tokens: {} },
        }))
      );

      const cw721Addresses = compact(
        cw721s.map(([error, result], index) => {
          if (error) {
            return null;
          }
          if (!isNil(result) && result?.count) {
            return contractAddresses[index] ?? null;
          }
          return null;
        })
      );

      await appendCw721sContractsData(redisClient, {
        lastOffset: lastPage,
        data: cw721Addresses,
      });
    }
  } while (hasMore);

  console.log(`[getAllInitializedCw721Contracts]: Ending here`);
}



module.exports = { syncAllInitializedCw721Contracts };
