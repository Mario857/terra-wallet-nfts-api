const { uniqBy, omit } = require("lodash");
const { keysToCamel } = require("./keysToCamel");
const axios = require("axios");
const { asyncAction } = require("./asyncAction");
const pMap = (...args) => import("p-map").then(({ default: pMap }) => pMap(...args));

const fallbackIPFSUrls = [
  "https://d1mx8bduarpf8s.cloudfront.net/",
  "https://ipfs.fleek.co/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

function fromIPFSImageURLtoImageURL(originUrl) {
  return fallbackIPFSUrls.map((ipfsUrl) => encodeURI((originUrl || "").replace("ipfs://", ipfsUrl)));
}

async function formatResponse(data) {
  const camelCasedData = keysToCamel(data);

  return {
    ownedCollections: uniqBy(camelCasedData, (cw721Info) => cw721Info.contractAddress).map(
      ({ contractAddress, name }) => ({
        collectionAddress: contractAddress,
        collectionName: name,
      })
    ),
    ownedTokens: await pMap(
      camelCasedData,
      async (cw721Info) => {
        let talisMeta = undefined;
        if ((cw721Info?.info?.tokenUri ?? "").includes("talis")) {
          const [error, response] = await asyncAction(await axios.get(cw721Info?.info?.tokenUri));

          if (error) {
            talisMeta = undefined;
          }
          if (response) {
            talisMeta = {
              ...response.data,
              attributes: Object.entries(omit(response.data, ["description", "media", "title"])).map(
                ([key, value]) => ({
                  displayType: null,
                  traitType: key,
                  value,
                })
              ),
            };
          }
        }

        const attributes =
          (talisMeta?.attributes ? talisMeta?.attributes : cw721Info?.info?.extension?.attributes) ?? [];

        return {
          tokenId: cw721Info.tokenId,
          collectionAddress: cw721Info.contractAddress,
          collectionName: cw721Info.name,
          symbol: cw721Info.symbol ?? "",
          imageUrl: talisMeta
            ? [talisMeta?.media ?? ""]
            : fromIPFSImageURLtoImageURL(cw721Info?.info?.extension?.image ?? ""),
          description: talisMeta ? talisMeta?.description ?? "" : cw721Info?.info?.extension?.description ?? "",
          name: talisMeta ? talisMeta.title : cw721Info?.info?.extension?.name ?? "",
          attributes: attributes,
          traits: attributes.map(({ traitType, value }) => [traitType, value]),
          owner: cw721Info?.access?.owner ?? "",
        };
      },
      { concurrency: 5 }
    ),
  };
}

module.exports = { formatResponse };
