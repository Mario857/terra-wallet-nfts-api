const { setupWasmExtension } = require("@cosmjs/cosmwasm-stargate");
const { QueryClient, setupTxExtension } = require("@cosmjs/stargate");
const { HttpBatchClient, Tendermint34Client } = require("@cosmjs/tendermint-rpc");
const { asyncAction } = require("./asyncAction");
const { RPC_URL } = require("./config");

let CACHED_WASM_CLIENT;

async function initWasmBatchClient() {
  const httpBatch = new HttpBatchClient(RPC_URL, {
    batchSizeLimit: 1000,
  });
  const queryClient = QueryClient.withExtensions(
    await Tendermint34Client.create(httpBatch),
    setupWasmExtension,
    setupTxExtension
  );

  if (!CACHED_WASM_CLIENT) {
    CACHED_WASM_CLIENT = queryClient;
  }

  return CACHED_WASM_CLIENT;
}

async function smartContractQuery(contractAddress, query, extend = {}) {
  if (!CACHED_WASM_CLIENT) {
    throw new Error("Wasm client not initialized!");
  }

  const queryClient = CACHED_WASM_CLIENT;

  const result = await queryClient.wasm.queryContractSmart(contractAddress, query);

  return {
    ...result,
    ...extend,
    contractAddress,
  };
}

async function batchContractQuery(queries) {
  if (!queries.length) {
    return Promise.resolve([]);
  }

  return Promise.all(
    queries.map((query) => {
      return asyncAction(smartContractQuery(query.contractAddress, query.query, query.extend));
    })
  );
}

module.exports = { initWasmBatchClient, batchContractQuery };
