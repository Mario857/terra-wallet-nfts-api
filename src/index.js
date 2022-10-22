const { LCDClient } = require("@terra-money/terra.js");
const express = require("express");
const { intersectionWith, isEqual } = require("lodash");
const bodyParser = require("body-parser");
const { queryWalletNFTs } = require("./queryWalletNFTs");
const { isValidTerraAddress } = require("./isValidTerraAddress");
const { syncAllCw721Contracts } = require("./syncAllCw721Contracts");
const cron = require("node-cron");
const AsyncLock = require("async-lock");
const { getCw721sContractsData } = require("./cache");
const { getInteractedContractAddresses } = require("./interactedContracts");
const lock = new AsyncLock();
const redisClient = require("redis").createClient(process.env.REDIS_URL);

const lcdClient = new LCDClient({
  URL: "https://pisco-lcd.terra.dev",
  chainID: "pisco-1",
});

const fcdUrl = "https://pisco-fcd.terra.dev";

(async () => {
  await redisClient.connect();

  await syncAllCw721Contracts(lcdClient, redisClient);
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
      return queryWalletNFTs(lcdClient, cache?.data ?? [], walletAddress);
    },
    function (error, result) {
      if (error) {
        return res.status(500).send(error);
      }
      res.send(result.flat());
    }
  );
});

app.get("/interacted-contracts/:walletAddress", async function (req, res) {
  const { walletAddress } = req.params;

  if (!isValidTerraAddress(walletAddress)) {
    return res.status(500).send("Invalid wallet address!");
  }

  const rawLogs = await getInteractedContractAddresses(fcdUrl, walletAddress);

  res.send(rawLogs);
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

  lock.acquire(
    walletAddress,
    async function () {
      const interactedContracts = await getInteractedContractAddresses(fcdUrl, walletAddress);

      let cache = await getCw721sContractsData(redisClient);

      const toQuery = intersectionWith(interactedContracts, cache?.data ?? [], isEqual);

      return queryWalletNFTs(lcdClient, redisClient, toQuery, walletAddress);
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

cron.schedule("0 */12 * * *", async () => syncAllCw721Contracts(lcdClient));
