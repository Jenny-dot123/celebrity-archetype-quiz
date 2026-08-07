window.CELEB_QUIZ_SUPABASE_CONFIG = Object.assign(
  {
    // 在这里填入你自己的 Supabase 项目参数
    // url 示例: https://your-project-ref.supabase.co
    url: "https://qolyudrhgbrkmovguezx.supabase.co",
    // 前端只使用 publishable key，不要把 secret key 放进网页
    anonKey: "sb_publishable_H3QQxTXIYjwvIHSXsLQNfQ_RID_NtZZ",
    // 正常情况下不需要改
    sdkUrl: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"
  },
  window.CELEB_QUIZ_SUPABASE_CONFIG || {}
);
