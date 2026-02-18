// lib/getOrgTokenFromAuth.js

export function getOrgTokenFromAuth(authOrUser) {
  const token = String(
    authOrUser?.org?.token ||
      authOrUser?.token ||
      authOrUser?.user?.Token ||
      authOrUser?.user?.token ||
      authOrUser?.user?.["Organization Token"] ||
      authOrUser?.Token ||
      authOrUser?.token ||
      authOrUser?.["Organization Token"] ||
      ""
  ).trim();

  // If your org tokens are consistently stored like "ORG-XXXX", normalize:
  return token.toUpperCase();
}
