// lib/amazon/creatorsApi.js
// Amazon Creators API v1 — OAuth 2.0 Bearer token auth.
//
// Auth flow: LWA client_credentials with Basic auth header → Bearer token
// Endpoint:  https://creatorsapi.amazon/catalog/v1/{operation}
// Params:    lowerCamelCase (keywords, partnerTag, itemIds, etc.)
// Resources: camelCase dot notation  (itemInfo.title, images.primary.large, etc.)
//
// Env vars:
//   AMAZON_CLIENT_ID     - amzn1.application-oa2-client.xxx  (Credential ID)
//   AMAZON_CLIENT_SECRET - amzn1.oa2-cs.v1.xxx               (Credential Secret)
//   AMAZON_PARTNER_TAG   - checkpeak03-20
//   AMAZON_MARKETPLACE   - www.amazon.com

const CLIENT_ID     = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const PARTNER_TAG   = process.env.AMAZON_PARTNER_TAG   || "checkpeak03-20";
const MARKETPLACE   = process.env.AMAZON_MARKETPLACE   || "www.amazon.com";

const TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const API_BASE  = "https://creatorsapi.amazon/catalog/v1";

// Token cache — valid for 1 hour, refreshed 60s early
let _cachedToken    = null;
let _tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiresAt - 60_000) return _cachedToken;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      "Amazon credentials not configured. " +
      "Set AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET from your Creators API dashboard."
    );
  }

  const res = await fetch(TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type:    "client_credentials",
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         "creatorsapi::default",
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amazon token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data      = await res.json();
  _cachedToken    = data.access_token;
  _tokenExpiresAt = now + (data.expires_in ?? 3600) * 1000;
  return _cachedToken;
}

async function apiPost(operation, body) {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}/${operation}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
      "x-marketplace": MARKETPLACE,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PAAPI ${operation} error ${res.status}: ${text.slice(0, 600)}`);
  }

  return res.json();
}

/* ── Resources ──────────────────────────────────────────────────────────── */

const ITEM_RESOURCES = [
  "itemInfo.title",
  "itemInfo.byLineInfo",
  "images.primary.large",
  "images.primary.medium",
  "offersV2.listings.price",
  "customerReviews.count",
  "customerReviews.starRating",
];

const VARIATION_RESOURCES = [
  "itemInfo.title",
  "images.primary.medium",
  "offersV2.listings.price",
  "variationSummary.variationDimension",
];

/* ── Normalizers ────────────────────────────────────────────────────────── */

export function normalizeItem(item) {
  const asin        = item.asin ?? item.ASIN;
  const title       = item.itemInfo?.title?.displayValue ?? "";
  const brand       = item.itemInfo?.byLineInfo?.brand?.displayValue ?? "";
  // price is an object {amount, currency, displayAmount}; starRating is {value, displayValue}
  const price       = item.offersV2?.listings?.[0]?.price?.amount
                   ?? item.offersV2?.listings?.[0]?.price ?? null;
  const image       = item.images?.primary?.large?.url
                   ?? item.images?.primary?.medium?.url ?? null;
  const rating      = item.customerReviews?.starRating?.value
                   ?? item.customerReviews?.starRating ?? null;
  const reviewCount = item.customerReviews?.count ?? null;

  return {
    asin,
    name:            title,
    brand,
    price:           price       != null ? Number(Number(price).toFixed(2))  : null,
    imageUrl:        image,
    rating:          rating      != null ? Number(Number(rating).toFixed(1)) : null,
    reviewCount:     reviewCount ?? null,
    boughtLastMonth: null,
    affiliateLink:   `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`,
    servings:        null,
    pricePerServing: null,
  };
}

const FLAVOR_NAMES = new Set(["flavor", "flavor_name", "item_flavor_name", "scent", "flavor_type"]);
const SIZE_NAMES   = new Set(["size", "size_name", "item_package_quantity", "unit_count"]);

function normalizeVariation(item) {
  const attrs  = item.variationAttributes ?? item.VariationAttributes ?? [];
  const flavor = attrs.find(a => FLAVOR_NAMES.has((a.name ?? a.Name ?? "").toLowerCase()));
  const size   = attrs.find(a => SIZE_NAMES.has((a.name ?? a.Name ?? "").toLowerCase()));
  const price  = item.offersV2?.listings?.[0]?.price?.amount
              ?? item.offersV2?.listings?.[0]?.price ?? null;

  return {
    asin:          item.asin ?? item.ASIN,
    flavor:        flavor?.value ?? flavor?.Value ?? null,
    size:          size?.value   ?? size?.Value   ?? null,
    price:         price != null ? Number(Number(price).toFixed(2)) : null,
    image:         item.images?.primary?.medium?.url ?? null,
    affiliateLink: `https://www.amazon.com/dp/${item.asin ?? item.ASIN}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`,
  };
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export async function searchItems(keywords, {
  searchIndex = "HealthPersonalCare",
  itemCount   = 10,
  sortBy      = "Relevance",
} = {}) {
  const data = await apiPost("searchItems", {
    partnerTag:  PARTNER_TAG,
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
  const data = await apiPost("getItems", {
    partnerTag:  PARTNER_TAG,
    marketplace: MARKETPLACE,
    itemIds:     asinList,
    itemIdType:  "ASIN",
    resources:   ITEM_RESOURCES,
  });
  return (data.itemsResult?.items ?? []).map(normalizeItem);
}

export async function getVariations(asin) {
  let data;
  try {
    data = await apiPost("getVariations", {
      partnerTag:  PARTNER_TAG,
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

  const items      = data.variationsResult?.items ?? [];
  const count      = data.variationsResult?.variationSummary?.variationCount ?? items.length;
  const variations = items.map(normalizeVariation).filter(v => v.flavor || v.size);
  return { count, variations };
}

export function buildAffiliateLink(asin) {
  return `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}&linkCode=ogi&th=1&psc=1`;
}
