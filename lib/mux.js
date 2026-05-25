// lib/mux.js
// Single Mux client instance shared across all API routes.
// Uses MUX_TOKEN_ID and MUX_TOKEN_SECRET from your Vercel env vars.

import Mux from "@mux/mux-node";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

export default mux;