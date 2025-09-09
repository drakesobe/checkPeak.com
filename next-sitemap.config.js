/** @type {import('next-sitemap').IConfig} */
const fs = require("fs");
const path = require("path");

// Helper to get last modified timestamp of a file
const getLastMod = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime.toISOString();
  } catch (err) {
    console.warn(`Could not get lastmod for ${filePath}:`, err);
    return new Date().toISOString();
  }
};

// Recursively read pages directory to get dynamic routes
const getDynamicPages = (dir, baseUrl = "") => {
  const paths = [];
  if (!fs.existsSync(dir)) return paths;

  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      paths.push(...getDynamicPages(fullPath, path.join(baseUrl, entry)));
    } else if (entry.endsWith(".js") || entry.endsWith(".tsx")) {
      let route = path.join(baseUrl, entry.replace(/\.(js|tsx)$/, ""));
      // Skip index pages since root is handled automatically
      if (route.endsWith("/index")) route = route.replace("/index", "");

      // Exclude API routes
      if (!route.startsWith("/api")) {
        paths.push({
          loc: route.startsWith("/") ? route : `/${route}`,
          lastmod: getLastMod(fullPath),
        });
      }
    }
  }

  return paths;
};

module.exports = {
  siteUrl: "https://checkpeak.com",
  generateRobotsTxt: true,
  sitemapSize: 5000,

  additionalPaths: async (config) => {
    const pagesDir = path.join(process.cwd(), "pages");
    const dynamicPaths = getDynamicPages(pagesDir);

    // Manually add any routes that may not exist as files (like smartstack or search)
    const extraRoutes = [
      { loc: "/smartstack", lastmod: new Date().toISOString() },
      { loc: "/search", lastmod: new Date().toISOString() },
    ];

    return [...dynamicPaths, ...extraRoutes];
  },
};
