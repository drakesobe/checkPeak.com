// lib/amazon/creatorsApi.js
// Amazon Creators API client — corrected for actual API response format.
// Based on official Creators API docs (GetItems, SearchItems, GetVariations).
//
// Key differences from PAAPI5:
//   - Resources are lowercase: images.primary.large, itemInfo.title, offersV2.listings.price
//   - Response wrapper: itemResults.items (not ItemsResult.Items)
//   - Price: offersV2.listings[0].price.money.amount
//   - Image: images.primary.large.url
//   - No CustomerReviews resource in Creators API
//
// Env vars:
//   AMAZON_CLIENT_ID     — amzn1.application-oa2-client.xxx
//   AMAZON_CLIENT_SECRET — amzn1.oa2-cs.v1.xxx  (rotate after any exposure!)
//   AMAZON_PARTNER_TAG   — checkpeak03-20
//   AMAZON_MARKETPLACE   — www.amazon.com

const CLIENT_ID     = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const PARTNER_TAG   = process.env.AMAZON_PARTNER_TAG   || "checkpeak03-20";
const MARKETPLACE   = process.env.AMAZON_MARKETPLACE   || "www.amazon.com";

const TOKEN_URL       = "https://api.amazon.com/auth/o2/token";
const PAAPI_HOST      = "https://webservices.amazon.com";
const SEARCH_PATH     = "/paapi5/searchitems";
const GET_PATH        = "/paapi5/getitems";
const VARIATIONS_PATH = "/paapi5/getvariations";

// Token cache
let _cachedToken    = null;
let _tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt - 60_000) return _cachedToken;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Amazon credentials not configured.");
  }

const params = new URLSearchParams({
  grant_type:    "client_credentials",
  client_id:     CLIENT_ID,
  client_secret: CLIENT_SECRET,
  scope:         "creatorsapi::default",
});

  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amazon token error ${res.status}: ${text}`);
  }

  const data      = await res.json();
  _cachedToken    = data.access_token;
  _tokenExpiresAt = now + (data.expires_in ?? 3600) * 1000;
  return _cachedToken;
}

async function papiPost(path, body) {
  const token = await getAccessToken();
  const res   = await fetch(`${PAAPI_HOST}${path}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PAAPI ${path} error ${res.status}: ${text.slice(0, 400)}`);
  }

  return res.json();
}

// Creators API resources — all lowercase
const ITEM_RESOURCES = [
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "images.primary.large",
  "images.primary.medium",
  "offersV2.listings.price",
];

const VARIATION_RESOURCES = [
  "itemInfo.title",
  "images.primary.medium",
  "offersV2.listings.price",
  "variationSummary.variationDimension",
];

// Normalizer — maps Creators API response fields to our stack shape
export function normalizeItem(item) {
  const asin  = item.asin ?? item.ASIN;
  const title = item.itemInfo?.title?.displayValue ?? "";
  const brand = item.itemInfo?.byLineInfo?.brand?.displayValue ?? "";
  const price = item.offersV2?.listings?.[0]?.price?.money?.amount ?? null;
  const image = item.images?.primary?.large?.url ?? item.images?.primary?.medium?.url ?? null;
  const affiliateLink = `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`;

  return {
    asin,
    name:            title,
    brand,
    price:           price != null ? Number(Number(price).toFixed(2)) : null,
    imageUrl:        image,
    rating:          null,  // Not in Creators API — preserve existing Airtable value
    reviewCount:     null,  // Not in Creators API — preserve existing Airtable value
    boughtLastMonth: null,  // Not in Creators API — preserve existing Airtable value
    affiliateLink,
    servings:        null,
    pricePerServing: null,
  };
}

const FLAVOR_ATTR_NAMES = new Set(["flavor", "flavor_name", "item_flavor_name", "scent", "flavor_type"]);
const SIZE_ATTR_NAMES   = new Set(["size", "size_name", "item_package_quantity", "unit_count"]);

function normalizeVariation(item) {
  const attrs  = item.variationAttributes ?? [];
  const flavor = attrs.find(a => FLAVOR_ATTR_NAMES.has(a.name?.toLowerCase()));
  const size   = attrs.find(a => SIZE_ATTR_NAMES.has(a.name?.toLowerCase()));
  const price  = item.offersV2?.listings?.[0]?.price?.money?.amount ?? null;

  return {
    asin:          item.asin,
    flavor:        flavor?.value ?? null,
    size:          size?.value   ?? null,
    price:         price != null ? Number(Number(price).toFixed(2)) : null,
    image:         item.images?.primary?.medium?.url ?? null,
    affiliateLink: `https://www.amazon.com/dp/${item.asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`,
  };
}

export async function searchItems(keywords, {
  searchIndex = "HealthPersonalCare",
  itemCount   = 10,
  sortBy      = "Relevance",
} = {}) {
  const data = await papiPost(SEARCH_PATH, {
    partnerTag:  PARTNER_TAG,
    partnerType: "Associates",
    marketplace: MARKETPLACE,
    keywords,
    searchIndex,
    itemCount,
    sortBy,
    resources:   ITEM_RESOURCES,
  });
  return (data.searchResult?.items ?? []).map(normalizeItem);
}

export async function getItems(asins) {
  const asinList = Array.isArray(asins) ? asins.slice(0, 10) : [asins];
  const data = await papiPost(GET_PATH, {
    partnerTag:  PARTNER_TAG,
    partnerType: "Associates",
    marketplace: MARKETPLACE,
    itemIds:     asinList,
    itemIdType:  "ASIN",
    resources:   ITEM_RESOURCES,
  });
  return (data.itemResults?.items ?? []).map(normalizeItem);
}

export async function getVariations(asin) {
  let data;
  try {
    data = await papiPost(VARIATIONS_PATH, {
      partnerTag:  PARTNER_TAG,
      partnerType: "Associates",
      marketplace: MARKETPLACE,
      asin,
      resources:   VARIATION_RESOURCES,
    });
  } catch (err) {
    if (err.message.includes("NoResult") || err.message.includes("404")) {
      return { count: 0, variations: [] };
    }
    throw err;
  }

  const items = data.variationsResult?.items ?? [];
  const count = data.variationsResult?.variationSummary?.variationCount ?? items.length;
  const variations = items.map(normalizeVariation).filter(v => v.flavor || v.size);
  return { count, variations };
}

export function buildAffiliateLink(asin) {
  return `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`;
}