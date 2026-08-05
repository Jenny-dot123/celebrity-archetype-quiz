# 外网部署说明（Render 方案）

这套项目已经整理成适合直接部署的版本，最省改动的外网方案是 `Render`。

## 你现在已经有的部署文件

- [package.json](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/package.json)
- [server.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/server.js)
- [render.yaml](/C:/Users/13922/Documents/Codex/2026-08-03/wo/render.yaml)
- [.gitignore](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/.gitignore)

## 为什么我推荐这个方案

- 你现在的密码系统是 `Node.js + 本地文件密码库`
- 这类结构不适合直接放到纯静态托管平台
- `Render` 可以直接跑 Node 服务
- 还可以挂一个持久化磁盘，保存密码库，不会因为重启丢失

## 你要做的事

1. 把整个项目上传到一个 GitHub 仓库
2. 注册并登录 Render
3. 在 Render 里连接这个 GitHub 仓库
4. 选择使用仓库根目录里的 `render.yaml`
5. 等待部署完成
6. 部署成功后，你会得到一个公网域名

## 部署完成后怎么用

你的公网测试入口会变成：

`https://你的域名/index.html`

你的公网密码管理页会变成：

`https://你的域名/password-admin.html`

使用顺序：

1. 打开密码管理页
2. 生成一个新密码
3. 把测试入口链接和密码一起发给别人
4. 对方直接打开公网链接即可测试

## 重要提醒

- 现在这套方案依赖 `持久化磁盘`
- 如果没有持久化存储，密码库会在服务重启后丢失
- 当前项目已经把密码数据目录改成支持环境变量 `DATA_DIR`
- `render.yaml` 已经把持久化目录挂载到了 `/var/data`

## 部署前你不用再改的部分

- 不需要再改单页前端
- 不需要再改密码逻辑
- 不需要再改测试入口

## 如果你下一步要我继续做

我可以继续帮你做两件事里的任意一个：

1. 帮你整理一份“GitHub 上传 + Render 点击部署”的超详细中文步骤
2. 继续把项目改成更适合正式商用的版本，比如加管理员口令、限制密码页访问、优化分享流程
