const SIGNUP_VALUES = {
  athlete:      5.0,
  organization: 75.0,
};

export function trackSignupConversion(email, type = "athlete") {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  if (email) {
    window.gtag("set", "user_data", { email });
  }

  window.gtag("event", "conversion", {
    send_to:  "AW-17990566633/giolCJ2S_70cEOmFyYJD",
    value:    SIGNUP_VALUES[type] ?? 5.0,
    currency: "USD",
  });
}
