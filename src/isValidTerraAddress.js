const { bech32 } = require("bech32");

function isValidTerraAddress(address) {
  try {
    const { prefix: decodedPrefix } = bech32.decode(address); // throw error if checksum is invalid
    // verify address prefix
    return decodedPrefix === "terra";
  } catch {
    // invalid checksum
    return false;
  }
}

module.exports = { isValidTerraAddress };
