// lib/gtag.js
export const GA_TRACKING_ID = "G-0HXXN1SJ9K";

// Standard pageview tracking
export const pageview = (url) => {
  if (typeof window.gtag === "function") {
    window.gtag("config", GA_TRACKING_ID, {
      page_path: url,
    });
  }
};

// Custom event tracking
export const event = ({ action, category, label, value }) => {
  if (typeof window.gtag === "function") {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};
