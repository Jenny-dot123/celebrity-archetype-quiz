# 可交付版本交接说明

入口文件：

- [index.html](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/index.html)

核心文件：

- [app.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/app.js)
- [styles.css](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/styles.css)
- [data.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/data.js)
- [build_frontend_data.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/scripts/build_frontend_data.js)

## 当前前端已具备的能力

1. 封面页
2. 密码输入页
3. 模式选择页
4. 24题答题页
5. 结果页
6. 本地续答逻辑
7. 本地演示密码逻辑
8. 64型计算逻辑
9. 192人结果命中逻辑
10. 分享结果页模式

## 当前分享结果页模式

当前版本已经支持：

- 结果页点击“复制分享文案”时，自动生成一个 `?share=...` 结果链接
- 他人打开这个链接时，只能看到结果页
- 不会直接进入测试流程
- 页面上的“前往密码入口”按钮，只会带去密码入口

这符合你之前定下的规则：

- 分享结果可以看
- 不能绕过密码直接测试

## 当前仍是前端演示逻辑的部分

### 1. 一次性密码

现在是浏览器本地模拟：

- 首次输入成功后绑定当前浏览器
- 完成结果后在本地记为已使用

正式上线时应由后端接管。

### 2. 分享图

当前“生成分享图位”还是前端占位按钮，需要接真实服务。

### 3. 结果补充文案

`当下表现 / 当前状态 / 人生建议 / 五维说明`

目前是前端根据：

- 最终结果人物
- 题目得分结构

自动生成的展示文案。

如果后面你希望每一位人物都有完全独立的正式文案，也可以继续改成后端字段下发。

## 建议后端接口

### 1. 验证密码

`POST /api/quiz/password/verify`

请求示例：

```json
{
  "password_code": "HEARTH-2408",
  "device_id": "device_xxxxxxxx"
}
```

返回示例：

```json
{
  "ok": true,
  "password_status": "active",
  "session_id": "sess_123",
  "resume_allowed": true
}
```

### 2. 保存答题进度

`POST /api/quiz/session/save`

请求示例：

```json
{
  "session_id": "sess_123",
  "mode": "female",
  "answers": {
    "Q1": "Q1_A",
    "Q2": "Q2_D"
  },
  "current_question_index": 2
}
```

### 3. 提交并生成结果

`POST /api/quiz/session/complete`

请求示例：

```json
{
  "session_id": "sess_123"
}
```

返回示例：

```json
{
  "share_id": "share_abc123",
  "result": {
    "result_id": "R001",
    "person_name": "蔡元培",
    "result_title": "你的名人原型：蔡元培",
    "similarity_percent": 94,
    "keyword_list": ["格局", "组织力", "开放性", "推动感"],
    "why_like": "......",
    "profile_summary": "......",
    "archetype_note": "......",
    "share_blurb": "......",
    "current_performance": "......",
    "current_state": "......",
    "life_advice": "......",
    "abilities": [
      { "label": "人际感应", "value": 86, "description": "......", "tone": "warm" }
    ]
  }
}
```

### 4. 获取分享结果页

`GET /api/quiz/result/share/:shareId`

返回：

- 只返回最终结果页需要展示的数据
- 不返回答题权限

## 数据构建方式

如果题库、类型表、结果表有更新，重新生成前端数据即可：

```bash
node C:\Users\13922\Documents\Codex\2026-08-03\wo\scripts\build_frontend_data.js
```

生成目标：

- [data.js](/C:/Users/13922/Documents/Codex/2026-08-03/wo/work/result-template/data.js)

## 这版更适合的用途

- 给开发直接接手
- 给你继续调页面文案
- 给你先做内部演示
- 用来确认整套交互路径是否顺
