# 本地预览说明

入口文件：

- [index.html](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/index.html)
- [password-admin.html](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/password-admin.html)
- [server.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/server.js)

## 当前已完成的流程

1. 封面页
2. 密码输入页
3. 模式选择页
4. 24题答题页
5. 结果页
6. 分享结果页模式

## 正式密码使用方式

推荐正式模式：

1. 在 [server.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/server.js) 所在目录运行 `node server.js`
2. 打开 `http://127.0.0.1:8787/password-admin.html`
3. 点击 `生成一个新密码`
4. 复制新密码
5. 把你实际发布出去的测试链接，和这个密码一起发给对方
6. 对方在 `http://你的域名/index.html` 输入该密码后进入测试

本地预览模式：

1. 先打开 [password-admin.html](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/password-admin.html)
2. 点击 `生成一个新密码`
3. 复制新密码
4. 把你实际发布出去的测试链接，和这个密码一起发给对方
5. 对方在 [index.html](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/index.html) 输入该密码后进入测试

说明：

- 正式服务模式下，密码保存在同一份服务端密码库里，可供不同设备验证
- 本地预览模式下，密码仍然只保存在当前浏览器里，适合你自己演示和检查流程
- 正式版不再预置公开演示密码
- 首次验证后会绑定当前浏览器
- 到达结果页后，这个密码会在当前浏览器里记为已使用
- 想继续发给新的测试者时，请重新生成一个新密码

## 当前实现方式

- 题库来自 `24题配置表`
- 类型映射来自 `64型配置表`
- 人物结果来自 `192人结果配置表`
- 前端会根据答题结果自动计算 `64型`
- 然后按 `男性 / 女性 / 随机` 模式命中最终人物
- 分享按钮会复制一份带 `?share=...` 的结果链接

## 当前仍属于前端演示逻辑的部分

- 一次性密码目前是本地演示逻辑，不是后台真发码
- 分享图按钮目前还是占位
- 结果页里 `当下表现 / 当前状态 / 人生建议 / 五维说明` 目前是前端根据结果和答题自动生成的展示文案

更多交接信息见：

- [DELIVERY_HANDOFF.md](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/DELIVERY_HANDOFF.md)
