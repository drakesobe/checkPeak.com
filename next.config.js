/** @type {import('next').NextConfig} */
const { withSentryConfig } = require("@sentry/nextjs");

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
};

const sentryConfig = {
  org: "checkpeak",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

// Skip Sentry's webpack instrumentation in development — it rewrites source
// files during compilation and causes Fast Refresh to loop.
module.exports = process.env.NODE_ENV === "development"
  ? nextConfig
  : withSentryConfig(nextConfig, sentryConfig);
