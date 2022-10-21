const { isNil } = require("lodash");
const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));
const { asyncAction } = require("./asyncAction");
const { parseTxResult } = require("./parseTxResult");

async function getAllCw721Contracts(lcdClient) {
  console.log("[getAllCw721Contracts]: API starts fetching cw721Contracts");
  let lastPage = 1;
  let result = [];
  let hasMore = false;
  let perPage = 100;

  const interactedContractsQuery = {
    events: [{ key: "message.action", value: "/cosmwasm.wasm.v1.MsgInstantiateContract" }],
  };

  let page = lastPage;

  do {
    const [error, data] = await asyncAction(
      lcdClient.tx.search({
        "pagination.offset": page,
        "pagination.limit": perPage,
        ...interactedContractsQuery,
      })
    );

    if (error) {
      lastPage = page;
      hasMore = false;
    }

    if (data) {
      console.warn(data.pagination);
      hasMore = !(data.txs.length < perPage);

      page += data.txs.length;
      // Tx hashes you can search in Terra Finder, or anything else replace here
      result.push(data.txs.flatMap((x) => parseTxResult(x)));
    }
  } while (hasMore);

  const interactedContracts = [
    ...new Set(
      result
        .flat()
        .filter((x) => x.ContractAddress)
        .map((x) => x.ContractAddress)
    ),
  ];

  const cw721s = await pMap(
    interactedContracts,
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

  console.log("[getAllCw721Contracts]: API fetched cw721Contracts");

  return cw721s.filter((x) => x);
}

module.exports = { getAllCw721Contracts };
