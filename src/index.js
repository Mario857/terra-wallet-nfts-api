const { LCDClient } = require("@terra-money/terra.js");
const express = require("express");
const bodyParser = require("body-parser");
const { queryWalletNFTs } = require("./queryWalletNFTs");
const fs = require("fs/promises");
const { isValidTerraAddress } = require("./isValidTerraAddress");
const { getAllCw721Contracts } = require("./getAllCw721Contract");
const cron = require("node-cron");
const AsyncLock = require("async-lock");
const lock = new AsyncLock();

const lcdClient = new LCDClient({
  URL: "https://phoenix-lcd.terra.dev",
  chainID: "phoenix-1",
});

(async () => {
  const freshCw721s = await getAllCw721Contracts(lcdClient);

  await fs.writeFile("cw721s.json", JSON.stringify(freshCw721s));
})();

// Initialize express
let app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Query by wallet address
app.get("/:walletAddress", async function (req, res) {
  const { walletAddress } = req.params;

  if (!isValidTerraAddress(walletAddress)) {
    return res.status(500).send("Invalid wallet address!");
  }

  lock.acquire(
    walletAddress,
    async function () {
      let cw721s = JSON.parse(await fs.readFile("./cw721s.json"));
      return queryWalletNFTs(lcdClient, cw721s, walletAddress);
    },
    function (error, result) {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result.flat());
    }
  );
});

app.listen(8080, function () {
  console.log("[app]: server is listening on port 8080");
});

cron.schedule("0 */12 * * *", async () => {
  const freshCw721s = await getAllCw721Contracts(lcdClient);

  await fs.writeFile("cw721s.json", JSON.stringify(freshCw721s));
});
