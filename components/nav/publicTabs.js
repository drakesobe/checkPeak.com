// components/nav/publicTabs.js

export const PUBLIC_TABS = [
  { name: "Scan", href: "/nutrition-label-scanner" },
  { name: "Search", href: "/search" },
  { name: "Info", href: "/info" },

  // ✅ Add NCAA Rules
  { name: "NCAA Rules", href: "/compliance/ncaa" },

  { name: "SmartStack", href: "/smartstack", icon: "mountain" },
];

// Optional helpers if you want consistent placement:
export const DESKTOP_LEFT_TABS = PUBLIC_TABS.filter((t) =>
  ["Scan", "Search", "Info"].includes(t.name)
);

export const DESKTOP_RIGHT_TABS = PUBLIC_TABS.filter((t) =>
  ["NCAA Rules", "SmartStack"].includes(t.name)
);

export const MOBILE_TABS = PUBLIC_TABS; // show all