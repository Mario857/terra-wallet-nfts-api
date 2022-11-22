const { compact, last, groupBy } = require("lodash");
const { getCw721Metadata, appendCw721sMetadata } = require("./cache");
const { formatResponse } = require("./formatResponse");
const { batchContractQuery } = require("./wasm");
const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));

async function queryUntilEnd(redisClient, userAddress, cw721s) {
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

    for (const [error, data] of ownerIds) {
      if (error || !data) {
        console.error(`[Query Wallet NFTs]: ${error}`);
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

      const cachedMeta = await getCw721Metadata(redisClient, data.contractAddress);

      result.push(
        tokens.map((tokenId) => ({
          tokenId,
          contractAddress: data.contractAddress,
          meta: cachedMeta?.data,
        }))
      );
    }
  } while (Object.values(processingAddresses).some((process) => !process.completed));

  return result.flat();
}

async function queryWalletNFTs(redisClient, userAddress, cw721s) {
  const tokensIdsByContractAddress = await queryUntilEnd(redisClient, userAddress, cw721s);

  const ownedTokensInfo = await batchContractQuery(
    tokensIdsByContractAddress
      .filter((f) => !f.meta.length)
      .map(({ tokenId, contractAddress }) => ({
        contractAddress,
        query: {
          nft_info: {
            token_id: tokenId,
          },
        },
        extend: { tokenId, ...cw721s.find((x) => x.contractAddress === contractAddress) },
      }))
  );

  await pMap(
    Object.entries(
      groupBy(compact(ownedTokensInfo.map(([error, data]) => (error ? null : data))), (owned) => owned.contractAddress)
    ),
    async ([contractAddress, owned]) => appendCw721sMetadata(redisClient, contractAddress, owned),
    {
      concurrency: 50,
    }
  );

  const ownedTokensParsed = compact(
    tokensIdsByContractAddress.map(({ tokenId, contractAddress, meta, ...rest }) => {
      const [, ownedMeta] =
        ownedTokensInfo.find(
          ([, owned]) => `${owned.contractAddress}_${owned.tokenId}` === `${contractAddress}_${tokenId}`
        ) ?? [];

      const cachedMeta = meta.find(
        (cached) => `${cached.contractAddress}_${cached.tokenId}` === `${contractAddress}_${tokenId}`
      );

      const parsedMeta = cachedMeta ? cachedMeta : ownedMeta;

      if (!parsedMeta) {
        return null;
      }

      return {
        tokenId,
        contractAddress,
        ...rest,
        ...parsedMeta,
      };
    })
  );

  return formatResponse(ownedTokensParsed);
}

module.exports = { queryWalletNFTs };
