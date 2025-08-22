import Card from "../components/Card";
import NavBar from "../components/NavBar";

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">About CheckSupp</h1>

        <Card title="Our Mission" className="bg-white border border-blue-100">
          <p className="text-gray-700">
            CheckSupp helps athletes and supplement users quickly identify banned substances
            in nutrition labels using OCR and searchable databases. Our goal is to keep
            you informed and safe while performing at your best.
          </p>
        </Card>

        <Card title="How It Works" className="bg-white border border-blue-100">
          <p className="text-gray-700">
            Upload a nutrition label to scan ingredients, or use the search functionality
            to look up substances. Our system highlights banned ingredients based on
            up-to-date data from trusted sources.
          </p>
        </Card>

        <Card title="Updates & Accuracy" className="bg-white border border-blue-100">
          <p className="text-gray-700">
            Banned substances and regulations can change periodically throughout the year.
            CheckSupp automatically reflects the latest updates from our database.
          </p>
        </Card>

        <Card title="Disclaimer" className="bg-white border border-blue-100">
          <p className="text-gray-700">
            CheckSupp is for informational purposes only. Always consult a qualified
            professional before consuming supplements, especially if you are competing
            in regulated sports.
          </p>
        </Card>
      </main>
    </div>
  );
}
