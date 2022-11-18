const { keysToCamel } = require("./keysToCamel");
const { findLast, merge } = require("lodash");

function parseInitializedContractTxResult(txResult, type = "instantiate") {
  return keysToCamel(
    Object.fromEntries(
      (
        findLast(
          txResult?.logs.flatMap((log) => log.events),
          (attribute) => attribute.type === type
        )?.attributes || []
      ).map(({ key, value }) => [key, value])
    )
  );
}

function parseTxResults(txResult, type = "wasm") {
  return txResult?.logs
    .flatMap((log) => log.events)
    .filter((attribute) => attribute.type === type)
    .map((attr) => merge((attr.attributes || []).map(({ key, value }) => keysToCamel({ [key]: value }))));
}

module.exports = { parseInitializedContractTxResult, parseTxResults };
