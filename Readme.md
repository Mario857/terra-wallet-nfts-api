## Node Js Terra Wallet NFTs API

### API for querying all wallet NFTs for specific user
API indexes all initialized cw721 contracts and caches using Redis DB, looks for new every 10 minutes. Starting from latest offset. 

Then uses batch querying on each contract to get users NFTs. If user has > 30 NFTs of specific collection. It queries till end.
It also supports Talis.

## Running with docker compose
* Docker

```bash
docker compose up -d

# Wait for indexer to finish fetching CW721 contract. Until you see message. Ending here for both services

# Testnet
curl localhost:3010/nft-wallet/<Terra Wallet Address>

# Mainnet
curl localhost:3020/nft-wallet/<Terra Wallet Address>

```

## Running Locally

* Node JS
* Git
* Redis DB

```bash
# install node modules
npm install

# add following variables to .env
RPC_URL=<RPC_URL>
CHAIN_ID=<CHAIN_ID>
LCD_URL=<LCD_URL>
API_PORT=<API_PORT>
REDIS_URL=<REDIS_URL>

# run app
node src/index.js

# Replace <terra1-wallet-address> with wallet you want to query
curl localhost:3000/nft-wallet/<Terra Wallet Address>
```