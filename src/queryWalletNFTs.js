const { compact, last } = require("lodash");
const { keysToCamel } = require("./keysToCamel");
const { batchContractQuery } = require("./wasm");

async function queryUntilEnd(userAddress, cw721Addresses) {
  let processingAddresses = Object.fromEntries(
    cw721Addresses.map((address) => [address, { completed: false, startAfter: undefined }])
  );

  const result = [];
  const LIMIT = 30;
  do {
    const filteredCw721Addresses = cw721Addresses.filter((address) => !processingAddresses[address].completed);
    const ownerIds = await batchContractQuery(
      filteredCw721Addresses.map((contractAddress) => ({
        contractAddress,
        query: {
          tokens: {
            start_after: processingAddresses[contractAddress]?.startAfter,
            owner: userAddress,
            limit: LIMIT,
          },
        },
      }))
    );

    const tokensIdsByContractAddress = compact(
      ownerIds.flatMap(([error, data], index) => {
        const contractAddress = filteredCw721Addresses[index];

        if (error) {
          return null;
        }

        const tokens = data?.tokens ?? data.ids ?? [];

        processingAddresses = {
          ...processingAddresses,
          [filteredCw721Addresses[index]]: { completed: error ? true : !last(tokens), startAfter: last(tokens) },
        };

        if (!tokens.length) {
          return null;
        }

        return tokens.map((tokenId) => ({ tokenId, contractAddress }));
      })
    );

    result.push(tokensIdsByContractAddress);
  } while (Object.values(processingAddresses).some((process) => !process.completed));

  return result.flat();
}

async function queryWalletNFTs(userAddress, cw721Addresses) {
  const tokensIdsByContractAddress = await queryUntilEnd(userAddress, cw721Addresses);

  const ownedTokensInfo = await batchContractQuery(
    tokensIdsByContractAddress.map(({ tokenId, contractAddress }) => ({
      contractAddress,
      query: {
        all_nft_info: {
          token_id: tokenId,
        },
      },
    }))
  );

  const ownedTokensParsed = compact(
    ownedTokensInfo.map(([, data], index) => {
      if (data) {
        return {
          ...data,
          contractAddress: tokensIdsByContractAddress[index]?.contractAddress ?? null,
        };
      }

      return null;
    })
  );

  return keysToCamel(ownedTokensParsed);
}

module.exports = { queryWalletNFTs };
