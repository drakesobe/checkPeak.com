// lib/amazon/creatorsApi.js
// Amazon Creators API client — OAuth2 bearer token auth, token cached in memory.
// Wraps SearchItems and GetItems from the PAAPI5-compatible endpoints.
//
// Env vars required:
//   AMAZON_CLIENT_ID     — amzn1.application-oa2-client.xxx
//   AMAZON_CLIENT_SECRET — your credential secret
//   AMAZON_PARTNER_TAG   — checkpeak03-20
//   AMAZON_MARKETPLACE   — www.amazon.com

const CLIENT_ID     = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const PARTNER_TAG   = process.env.AMAZON_PARTNER_TAG   || "checkpeak03-20";
const MARKETPLACE   = process.env.AMAZON_MARKETPLACE   || "www.amazon.com";

const TOKEN_URL    = "https://api.amazon.com/auth/o2/token";
const PAAPI_HOST   = "https://webservices.amazon.com";
const SEARCH_PATH  = "/paapi5/searchitems";
const GET_PATH     = "/paapi5/getitems";

// ─── Token cache (module-level, survives warm Lambda invocations) ─────────────
let _cachedToken   = null;
let _tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt - 60_000) {
    return _cachedToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Amazon credentials not configured. Set AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET.");
  }

  const params = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope:         "paapi:read",
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

  const data = await res.json();
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

// ─── Resources we request on every call ───────────────────────────────────────
const RESOURCES = [
  "ItemInfo.Title",
  "ItemInfo.ByLineInfo",
  "Offers.Listings.Price",
  "Offers.Listings.Availability.Type",
  "Offers.Summaries.LowestPrice",
  "Images.Primary.Large",
  "Images.Primary.Medium",
  "CustomerReviews.Count",
  "CustomerReviews.StarRating",
  "BrowseNodeInfo.BrowseNodes",
  "ItemInfo.ProductInfo",
];

// ─── Response normalizer — maps raw PAAPI item to our stack shape ──────────────
export function normalizeItem(item) {
  const asin     = item.ASIN;
  const title    = item.ItemInfo?.Title?.DisplayValue ?? "";
  const brand    = item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? "";

  // Price — prefer listing price, fall back to summary lowest
  const listing  = item.Offers?.Listings?.[0]?.Price?.Amount;
  const lowest   = item.Offers?.Summaries?.[0]?.LowestPrice?.Amount;
  const price    = listing ?? lowest ?? null;

  const image    = item.Images?.Primary?.Large?.URL
                ?? item.Images?.Primary?.Medium?.URL
                ?? null;

  const rating      = item.CustomerReviews?.StarRating?.Value    ?? null;
  const reviewCount = item.CustomerReviews?.Count                ?? null;

  // Affiliate link — always use standard dp format with partner tag
  const affiliateLink = `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`;

  return {
    asin,
    name:         title,
    brand,
    price:        price ? Number(price.toFixed(2)) : null,
    imageUrl:     image,
    rating:       rating ? Number(Number(rating).toFixed(1)) : null,
    reviewCount:  reviewCount ?? null,
    affiliateLink,
    // servings + pricePerServing must be set manually or via scraping —
    // the Amazon API doesn't return supplement-specific label data.
    servings:        null,
    pricePerServing: null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for products by keyword.
 * @param {string} keywords
 * @param {object} opts
 * @param {string} opts.searchIndex  e.g. "HealthPersonalCare" (default)
 * @param {number} opts.itemCount    1–10 (default 10)
 * @param {string} opts.sortBy       Relevance | Featured | Price:LowToHigh | Price:HighToLow | AvgCustomerReviews
 * @returns {Promise<Array>} normalized items
 */
export async function searchItems(keywords, {
  searchIndex = "HealthPersonalCare",
  itemCount   = 10,
  sortBy      = "Relevance",
} = {}) {
  const data = await papiPost(SEARCH_PATH, {
    PartnerTag:   PARTNER_TAG,
    PartnerType:  "Associates",
    Marketplace:  MARKETPLACE,
    Keywords:     keywords,
    SearchIndex:  searchIndex,
    ItemCount:    itemCount,
    SortBy:       sortBy,
    Resources:    RESOURCES,
  });

  return (data.SearchResult?.Items ?? []).map(normalizeItem);
}

/**
 * Get one or more products by ASIN.
 * @param {string|string[]} asins  Single ASIN or array (max 10)
 * @returns {Promise<Array>} normalized items
 */
export async function getItems(asins) {
  const asinList = Array.isArray(asins) ? asins.slice(0, 10) : [asins];

  const data = await papiPost(GET_PATH, {
    PartnerTag:  PARTNER_TAG,
    PartnerType: "Associates",
    Marketplace: MARKETPLACE,
    ItemIds:     asinList,
    Resources:   RESOURCES,
  });

  return (data.ItemsResult?.Items ?? []).map(normalizeItem);
}

/**
 * Build a clean affiliate link for any ASIN without making an API call.
 * Use this when you already have the ASIN but need the tagged URL.
 */
export function buildAffiliateLink(asin) {
  return `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`;
}