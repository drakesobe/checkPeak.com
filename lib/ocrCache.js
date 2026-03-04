// lib/ocrCache.js
/**
 * Shared OCR cache used by NutritionModal and CompareModal.
 *
 * Single source of truth — both modals share the same cache so:
 *   - A scan done in NutritionModal is instantly available in CompareModal
 *   - Eviction in one doesn't corrupt the other's state
 *   - Tesseract import is cached once for the whole session
 *
 * Exports:
 *   touchCache(map, key, value)  — write to a cache map with FIFO eviction
 *   deleteCacheKey(key)          — atomically clear a key from all maps
 *   getTesseract()               — singleton dynamic import of tesseract.js
 *   ocrCache                     — imageUrl -> ocrText
 *   recordsCache                 — imageUrl -> { banned, ingredients }
 *   loadingCache                 — imageUrl -> boolean (concurrent run guard)
 */

const MAX_CACHE_ITEMS = 50;

export const ocrCache     = Object.create(null); // imageUrl -> string
export const recordsCache = Object.create(null); // imageUrl -> { banned[], ingredients[] }
export const loadingCache = Object.create(null); // imageUrl -> boolean

// FIFO insertion order for eviction
const cacheOrder = [];

/**
 * Write `value` to `map[key]`, evicting the oldest entry across all three
 * maps when the total number of tracked keys exceeds MAX_CACHE_ITEMS.
 */
export function touchCache(map, key, value) {
  if (!key) return;

  if (!(key in map)) {
    cacheOrder.push(key);
    while (cacheOrder.length > MAX_CACHE_ITEMS) {
      const oldest = cacheOrder.shift();
      if (!oldest) continue;
      delete ocrCache[oldest];
      delete recordsCache[oldest];
      delete loadingCache[oldest];
    }
  }

  map[key] = value;
}

/**
 * Atomically remove a key from all three cache maps and the order list.
 * Call this before a forced re-scan to ensure a clean run.
 */
export function deleteCacheKey(key) {
  if (!key) return;
  delete ocrCache[key];
  delete recordsCache[key];
  delete loadingCache[key];
  const idx = cacheOrder.indexOf(key);
  if (idx >= 0) cacheOrder.splice(idx, 1);
}

// Singleton Tesseract import — one dynamic import for the whole session
let tesseractPromise = null;

/**
 * Returns the Tesseract.js default export, importing it once and caching
 * the promise so subsequent calls never re-import the module.
 */
export async function getTesseract() {
  if (!tesseractPromise) {
    tesseractPromise = import("tesseract.js").then((m) => m.default);
  }
  return tesseractPromise;
}