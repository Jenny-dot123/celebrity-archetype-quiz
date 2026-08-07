# 你最像哪个名人

当前可直接打开的页面：

- [测试首页](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/index.html)
- [密码管理页](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/password-admin.html)
- [Supabase 配置文件](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/supabase-app-config.js)
- [Supabase 初始化 SQL](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/supabase-setup.sql)

当前项目分成两种运行方式：

1. 本地双击 `index.html`
   页面会自动进入静态演示版，方便你继续看样式、看流程、改文案。
2. 通过公开链接或本地服务器访问
   页面会自动进入正式发码版，走 Supabase 后端。

正式发码版的规则：

1. 你在 `password-admin.html` 里生成一个新密码。
2. 把测试链接和这个密码一起发给对方。
3. 对方第一次验证成功后，密码会绑定到对方当前浏览器。
4. 中途没做完，可以在同一浏览器继续。
5. 到达结果页后，这个密码自动作废。
6. 结果页可以分享，但别人只能看结果，不能直接进测试。

现在的推荐上线路线：

1. 免费数据库后端：Supabase
2. 免费公开链接：GitHub Pages
3. 自动发布：GitHub Actions

如果你要继续做正式上线，下一步只需要做两件事：

1. 在 Supabase 新建项目并执行 `supabase-setup.sql`
2. 把 `supabase-app-config.js` 填上你自己的 `url` 和 `anonKey`
