// lib/airtableTable.js
import Airtable from "airtable";

/**
 * Returns an Airtable table handle, supporting either TABLE_NAME or TABLE_ID env styles.
 * - Prefer TABLE_ID if present (stable)
 * - Fallback to TABLE_NAME (human readable)
 */
export function getAirtableTable({
  apiKey,
  baseId,
  tableId,
  tableName,
  defaultTableName,
}) {
  if (!apiKey || !baseId) return null;

  const base = new Airtable({ apiKey }).base(baseId);
  const table = tableId || tableName || defaultTableName;
  if (!table) return null;

  return base(table);
}
