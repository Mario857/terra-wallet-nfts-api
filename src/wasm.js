const { setupWasmExtension } = require("@cosmjs/cosmwasm-stargate");
const { QueryClient } = require("@cosmjs/stargate");
const { HttpBatchClient, Tendermint34Client } = require("@cosmjs/tendermint-rpc");
const { asyncAction } = require("./asyncAction");

let CACHED_WASM_CLIENT;

async function initWasmClient() {
  const httpBatch = new HttpBatchClient(
    `https://terra-rpc.polkachu.com`,
    {
      batchSizeLimit: 1000,
    }
  );
  const queryClient = QueryClient.withExtensions(await Tendermint34Client.create(httpBatch), setupWasmExtension);

  if (!CACHED_WASM_CLIENT) {
    CACHED_WASM_CLIENT = queryClient;
  }

  return CACHED_WASM_CLIENT;
}

async function batchContractQuery(queries) {
  if (!CACHED_WASM_CLIENT) {
    throw new Error("Wasm client not initialized!");
  }

  const queryClient = CACHED_WASM_CLIENT;

  if (!queries.length) {
    return Promise.resolve([]);
  }

  return Promise.all(
    queries.map((query) => {
      return asyncAction(queryClient.wasm.queryContractSmart(query.contractAddress, query.query));
    })
  );
}

module.exports = { initWasmClient, batchContractQuery };
