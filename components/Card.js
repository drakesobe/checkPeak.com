export default function Card({ title, children }) {
  return (
    <div className="bg-white border border-blue-100 rounded-2xl shadow-md p-6">
      {title && <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>}
      <div className="text-gray-700">{children}</div>
    </div>
  );
}
