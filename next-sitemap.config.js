/** @type {import('next-sitemap').IConfig} */

// Only these routes are indexed. Everything else (app, auth, API, share tokens) is left out.
const PUBLIC_PATHS = {
  "/":                             { priority: 1.0, changefreq: "weekly"  },
  "/pricing":                      { priority: 0.9, changefreq: "weekly"  },
  "/book":                         { priority: 0.9, changefreq: "monthly" },
  "/info":                         { priority: 0.7, changefreq: "monthly" },
  "/compliance/ncaa":              { priority: 0.7, changefreq: "monthly" },
  "/smartstack-compare":           { priority: 0.6, changefreq: "weekly"  },
  "/nutrition-label-scanner":      { priority: 0.6, changefreq: "monthly" },
  "/supplement-label-scanner":     { priority: 0.6, changefreq: "monthly" },
  "/pre-workout-label-scanner":    { priority: 0.6, changefreq: "monthly" },
  "/protein-powder-label-scanner": { priority: 0.6, changefreq: "monthly" },
  "/banned-substance-checker":     { priority: 0.6, changefreq: "monthly" },
  "/trainers":                     { priority: 0.5, changefreq: "weekly"  },
  "/faq":                          { priority: 0.5, changefreq: "monthly" },
  "/contact":                      { priority: 0.4, changefreq: "yearly"  },
  "/privacy":                      { priority: 0.2, changefreq: "yearly"  },
  "/terms":                        { priority: 0.2, changefreq: "yearly"  },
};

const entryFor = (loc) => ({
  loc,
  ...PUBLIC_PATHS[loc],
  lastmod: new Date().toISOString(),
});

module.exports = {
  siteUrl: "https://checkpeak.com",
  generateIndexSitemap: false,
  generateRobotsTxt: true,

  transform: async (_config, path) => (PUBLIC_PATHS[path] ? entryFor(path) : null),
  additionalPaths: async () => Object.keys(PUBLIC_PATHS).map(entryFor),

  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        // og-image must stay crawlable or link previews (Slack, X, iMessage) lose their image
        allow: ["/", "/api/og-image"],
        disallow: [
          "/api/",
          "/account",
          "/dashboard",
          "/org/",
          "/org-login",
          "/athlete/",
          "/athlete-signup/",
          "/commercial/",
          "/setup/",
          "/onboarding",
          "/finish-setup",
          "/reset-password",
          "/parent/",
          "/conversation/",
          "/scans",
          "/saved-stacks",
        ],
      },
    ],
  },
};
