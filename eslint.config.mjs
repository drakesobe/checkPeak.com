// eslint.config.mjs
// Next.js recommended rules (core-web-vitals). Rules that catch real bugs are errors and fail CI;
// style-level rules are warnings so existing pages don't block a deploy while they're cleaned up.
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";

const compat = new FlatCompat({ baseDirectory: path.resolve(import.meta.dirname) });

export default [
  {
    ignores: [
      ".next/**", "node_modules/**", "coverage/**", "public/**", "out/**",
      "next-env.d.ts", "**/*.min.js",
    ],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Bugs: keep as errors
      "react-hooks/rules-of-hooks": "error",
      "no-undef": "off", // Next/React globals; undefined variables are caught by the build
      // Style / gradual cleanup: warnings
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",
      "jsx-a11y/alt-text": "warn",
      "import/no-anonymous-default-export": "off",
    },
  },
  {
    files: ["tests/**", "scripts/**", "*.config.{js,mjs}"],
    rules: { "@next/next/no-assign-module-variable": "off" },
  },
];
