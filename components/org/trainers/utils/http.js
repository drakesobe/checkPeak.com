// components/org/trainers/utils/http.js
export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
