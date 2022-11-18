const { LCDClient } = require("@terra-money/terra.js");
const express = require("express");
const bodyParser = require("body-parser");
const { queryWalletNFTs } = require("./queryWalletNFTs");
const { isValidTerraAddress } = require("./isValidTerraAddress");
const { syncAllInitializedCw721Contracts } = require("./syncAllCw721Contracts");
const cron = require("node-cron");
const AsyncLock = require("async-lock");
const { getCw721sContractsData } = require("./cache");
const { initWasmClient } = require("./wasm");
const lock = new AsyncLock();
const redisClient = require("redis").createClient(process.env.REDIS_URL);

const lcdClient = new LCDClient({
  URL: "https://phoenix-lcd.terra.dev",
  chainID: "phoenix-1",
});

(async () => {
  await redisClient.connect();

  await initWasmClient();

  await syncAllInitializedCw721Contracts(lcdClient, redisClient);
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
      let cache = await getCw721sContractsData(redisClient);

      return queryWalletNFTs(lcdClient, redisClient, cache?.data ?? [], walletAddress);
    },
    function (error, result) {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result.flat());
    }
  );
});

app.get("/contracts/all", async function (req, res) {
  let cache = await getCw721sContractsData(redisClient);

  res.send(cache.data ?? []);
});

// Query by wallet address
app.get("/wallet-nfts/:walletAddress", async function (req, res) {
  const { walletAddress } = req.params;

  if (!isValidTerraAddress(walletAddress)) {
    return res.status(500).send("Invalid wallet address!");
  }

  let cache = await getCw721sContractsData(redisClient);

  const nfts = await  queryWalletNFTs(walletAddress, cache.data ?? []);

  res.send(nfts);
});

app.listen(8080, function () {
  console.log("[app]: server is listening on port 8080");
});

cron.schedule("0 */12 * * *", async () => syncAllInitializedCw721Contracts(lcdClient, redisClient));
