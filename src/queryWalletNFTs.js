const { compact, last } = require("lodash");
const { formatResponse } = require("./formatResponse");
const { batchContractQuery } = require("./wasm");

async function queryUntilEnd(userAddress, cw721s) {
  let processingAddresses = Object.fromEntries(
    cw721s.map(({ contractAddress }) => [contractAddress, { completed: false, startAfter: undefined }])
  );

  const result = [];
  const LIMIT = 30;
  do {
    const filteredCw721Addresses = cw721s.filter(
      ({ contractAddress }) => !processingAddresses[contractAddress].completed
    );
    const ownerIds = await batchContractQuery(
      filteredCw721Addresses.map(({ contractAddress }) => ({
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

    for await (const [error, data] of ownerIds) {
      if (error || !data) {
        processingAddresses = {
          ...processingAddresses,
          [data.contractAddress]: { completed: true, startAfter: undefined },
        };
        continue;
      }

      const tokens = data?.tokens ?? data.ids ?? [];

      processingAddresses = {
        ...processingAddresses,
        [data.contractAddress]: { completed: !last(tokens), startAfter: last(tokens) },
      };

      result.push(tokens.map((tokenId) => ({ tokenId, contractAddress: data.contractAddress })));
    }
  } while (Object.values(processingAddresses).some((process) => !process.completed));

  return result.flat();
}

async function queryWalletNFTs(userAddress, cw721s) {
  console.time("tokensIdsByContractAddress");
  const tokensIdsByContractAddress = await queryUntilEnd(userAddress, cw721s);
  console.timeEnd("tokensIdsByContractAddress");

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
