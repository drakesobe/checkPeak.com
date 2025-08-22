export default function ResultsTable({ records = [] }) {
  if (!records || records.length === 0) return null;

  const bgForBanType = (banType) => {
    if (banType === "Prohibited") return "bg-red-100";
    if (banType === "Limited Out of Competition") return "bg-yellow-100";
    if (banType === "Particular Sports") return "bg-green-100";
    return "transparent";
  };

  return (
    <div className="overflow-x-auto mt-4">
      <table className="min-w-full bg-white rounded-lg shadow-md overflow-hidden">
        <thead className="bg-gray-200">
          <tr>
            {[
              "Substance Name",
              "Synonyms",
              "Banned By",
              "Ban Type",
              "Dosage Limit",
              "Notes",
              "Source / Citation",
            ].map((h) => (
              <th key={h} className="px-4 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((row) => {
            const fields = row.fields || {};
            const banType = fields["Ban Type"] || "None";
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className={`px-4 py-2 ${bgForBanType(banType)}`}>
                  {fields["Substance Name"] || ""}
                </td>
                <td className="px-4 py-2">{fields["Synonyms"] || ""}</td>
                <td className="px-4 py-2">{fields["Banned By"] || ""}</td>
                <td className="px-4 py-2">{banType}</td>
                <td className="px-4 py-2">{fields["Dosage Limit"] || ""}</td>
                <td className="px-4 py-2">{fields["Notes"] || ""}</td>
                {/* ✅ Sources column: wraps & scrolls if needed */}
                <td className="px-4 py-2 max-w-xs break-words whitespace-normal">
                  {fields["Source / Citation"] || ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
