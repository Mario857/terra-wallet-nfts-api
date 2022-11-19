const { uniqBy } = require("lodash");
const { keysToCamel } = require("./keysToCamel");

const fallbackIPFSUrls = [
  "https://d1mx8bduarpf8s.cloudfront.net/",
  "https://ipfs.fleek.co/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

function fromIPFSImageURLtoImageURL(originUrl) {
  return fallbackIPFSUrls.map((ipfsUrl) => encodeURI((originUrl || "").replace("ipfs://", ipfsUrl)));
}

function formatResponse(data) {
  const camelCasedData = keysToCamel(data);

  return {
    ownedCollections: uniqBy(camelCasedData, (cw721Info) => cw721Info.contractAddress).map(
      ({ contractAddress, name }) => ({
        collectionAddress: contractAddress,
        collectionName: name,
      })
    ),
    ownedTokens: camelCasedData.map((cw721Info) => ({
      tokenId: cw721Info.tokenId,
      collectionAddress: cw721Info.contractAddress,
      collectionName: cw721Info.name,
      symbol: cw721Info.symbol ?? "",
      imageUrl: fromIPFSImageURLtoImageURL(cw721Info?.info?.extension?.image ?? ""),
      description: cw721Info?.info?.extension?.description ?? "",
      name: cw721Info?.info?.extension?.name ?? "",
      attributes: cw721Info?.info?.extension?.attributes ?? [],
      traits: (cw721Info?.info?.extension?.attributes ?? []).map(({ traitType, value }) => [traitType, value]),
      owner: cw721Info?.access?.owner ?? "",
    })),
  };
}

module.exports = { formatResponse };
