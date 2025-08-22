import Card from "../components/Card";
import NavBar from "../components/NavBar";

export default function BlogsPage() {
  const blogs = [
    {
      id: 1,
      title: "Understanding Banned Substances in Supplements",
      excerpt:
        "Learn how banned substances can appear in supplements and how to use CheckSupp to identify them.",
      link: "#",
    },
    {
      id: 2,
      title: "Tips for Reading Nutrition Labels",
      excerpt:
        "A guide to interpreting labels and spotting ingredients that could impact your performance.",
      link: "#",
    },
    {
      id: 3,
      title: "Safe Supplement Practices",
      excerpt:
        "Best practices for supplement usage and staying compliant with sports regulations.",
      link: "#",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">CheckSupp Blog</h1>

        <div className="space-y-6">
          {blogs.map((blog) => (
            <Card key={blog.id} title={blog.title} className="bg-white border border-blue-100">
              <p className="text-gray-700">{blog.excerpt}</p>
              <a
                href={blog.link}
                className="mt-2 inline-block text-[#46769B] hover:text-blue-700 font-semibold"
              >
                Read More →
              </a>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
