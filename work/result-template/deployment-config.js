window.CELEB_QUIZ_APP_CONFIG = Object.assign(
  {
    // "static" = 始终本地静态演示版
    // "server" = 始终正式发码版
    // "auto" = 本地 file:// 自动走静态版，http/https 自动走正式版
    mode: "auto"
  },
  window.CELEB_QUIZ_APP_CONFIG || {}
);
