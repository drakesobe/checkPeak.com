// pages/Banned.js
import { useState } from "react";
import Card from "../components/Card";
import SearchBar from "../components/SearchBar";
import ResultsTable from "../components/ResultsTable";

export default function BannedPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.records || []);
    } catch (e) {
      setErr(e.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <Card title="Banned Substance Search">
        <SearchBar value={query} onChange={setQuery} onSearch={handleSearch} placeholder="Enter substance name…" />
        {loading && <p style={{ marginTop: "1rem" }}>Loading…</p>}
        {err && <p style={{ marginTop: "1rem", color: "crimson" }}>{err}</p>}
        <ResultsTable records={results} />
      </Card>
    </div>
  );
}
