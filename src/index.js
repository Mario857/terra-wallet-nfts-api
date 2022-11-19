require("dotenv").config();
const { LCDClient } = require("@terra-money/terra.js");
const express = require("express");
const bodyParser = require("body-parser");
const { queryWalletNFTs } = require("./queryWalletNFTs");
const { isValidTerraAddress } = require("./isValidTerraAddress");
const { syncAllInitializedCw721Contracts } = require("./syncAllCw721Contracts");
const cron = require("node-cron");
const AsyncLock = require("async-lock");
const { getCw721sContractsData } = require("./cache");
const { initWasmBatchClient } = require("./wasm");
const cors = require("cors");
const { LCD_URL, CHAIN_ID, API_PORT, REDIS_URL } = require("./config");
const lock = new AsyncLock();
const redisClient = require("redis").createClient({
  url: REDIS_URL,
});

const lcdClient = new LCDClient({
  URL: LCD_URL,
  chainID: CHAIN_ID,
});

(async () => {
  await redisClient.connect();

  await initWasmBatchClient();

  await syncAllInitializedCw721Contracts(lcdClient, redisClient);
})();

// Initialize express
let app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

// Query by wallet address
app.get("/nft-wallet/:walletAddress", async function (req, res) {
  const { walletAddress } = req.params;

  if (!isValidTerraAddress(walletAddress)) {
    return res.status(500).send("Invalid wallet address!");
  }

  lock.acquire(
    walletAddress,
    async function () {
      let cache = await getCw721sContractsData(redisClient);

      return queryWalletNFTs(walletAddress, cache.data ?? []);
    },
    function (error, result) {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result);
    }
  );
});

app.get("/contracts/all", async function (req, res) {
  let cache = await getCw721sContractsData(redisClient);

  res.send(cache.data ?? []);
});

app.listen(parseInt(API_PORT, 10), function () {
  console.log(`[app]: server is listening on port ${API_PORT}`);
});

cron.schedule("*/10 * * * *", async () => syncAllInitializedCw721Contracts(lcdClient, redisClient));
