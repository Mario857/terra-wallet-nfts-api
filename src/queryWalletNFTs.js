const { compact, last } = require("lodash");
const { formatResponse } = require("./formatResponse");
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

        return tokens.map((tokenId) => ({ tokenId, contractAddress: data.contractAddress }));
      })
    );

    result.push(tokensIdsByContractAddress);
  } while (Object.values(processingAddresses).some((process) => !process.completed));

  return result.flat();
}

async function queryWalletNFTs(userAddress, cw721s) {
  const tokensIdsByContractAddress = await queryUntilEnd(
    userAddress,
    cw721s.map((cw721) => cw721.contractAddress)
  );

  const ownedTokensInfo = await batchContractQuery(
    tokensIdsByContractAddress.map(({ tokenId, contractAddress }) => ({
      contractAddress,
      query: {
        all_nft_info: {
          token_id: tokenId,
        },
      },
      extend: { tokenId },
    }))
  );

  const ownedTokensParsed = compact(
    ownedTokensInfo.map(([, data]) => {
      if (data) {
        return {
          ...data,
          ...cw721s.find((cw721) => cw721.contractAddress === data.contractAddress),
        };
      }

      return null;
    })
  );


  return formatResponse(ownedTokensParsed);
}

module.exports = { queryWalletNFTs };
