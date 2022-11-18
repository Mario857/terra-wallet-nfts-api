## Node Js Terra Wallet NFTs API

### API for querying all wallet NFTs for specific user

## Requirements

* Node JS
* Git

```bash
# install node modules
npm install
# run app
node run src/index.js

# Replace <terra1-wallet-address> with wallet you want to query
curl localhost:8080/wallet-nfts/<terra1-wallet-address>
```