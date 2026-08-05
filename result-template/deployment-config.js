window.CELEB_QUIZ_APP_CONFIG = Object.assign(
  {
    // "static" = free static hosting (GitHub Pages / Cloudflare Pages / Netlify)
    // "server" = paid backend mode with real shared one-time passwords
    // "auto" = infer from protocol
    mode: "static"
  },
  window.CELEB_QUIZ_APP_CONFIG || {}
);
