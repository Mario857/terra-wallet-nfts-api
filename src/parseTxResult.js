const { keysToCamel } = require("./keysToCamel");
const { findLast } = require("lodash");

function parseTxResult(txResult) {
  return keysToCamel(
    Object.fromEntries(
      (
        findLast(
          txResult?.logs.flatMap((log) => log.events),
          (attribute) => attribute.type === "instantiate"
        )?.attributes || []
      ).map(({ key, value }) => [key, value])
    )
  );
}

module.exports = { parseTxResult };
