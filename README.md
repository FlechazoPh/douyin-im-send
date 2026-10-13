# douyin-im-send

[![CI](https://github.com/FlechazoPh/douyin-im-send/actions/workflows/ci.yml/badge.svg)](https://github.com/FlechazoPh/douyin-im-send/actions/workflows/ci.yml)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/FlechazoPh/douyin-im-send)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/FlechazoPh/douyin-im-send)

用**你自己的登录 Cookie**，给抖音好友发一条文本私信。

零依赖（Node.js 18+ 自带 `fetch`，不用 `npm install`），两种用法：

- 🖥️ **命令行**：查好友、发私信，适合脚本和自动化
- 🌐 **网页版**：粘贴 Cookie → 点选好友 → 发送，适合手机/不方便用终端的场景

> ⚠️ **安全提醒**：Cookie 等同于你的登录态。不要发给任何人，不要提交到仓库。
> 网页版把它只保存在你浏览器的 localStorage，服务端不写磁盘、不记日志。

## 一键运行 / 一键部署

| 方式 | 操作 |
|---|---|
| Codespaces 一键运行 | 点上方徽章 → 环境自动配好 → `node src/send.js --help` |
| Render 一键部署网页版 | 点上方 **Deploy to Render** → 得到一个公网可访问的网页版 |
| Docker | `docker build -t douyin-im-send . && docker run -p 3000:3000 douyin-im-send`，打开 http://localhost:3000 |
| 本地网页版 | `node web/server.mjs`，打开 http://localhost:3000 |
| 本地命令行 | 见下文，无需安装依赖 |

## 准备：导出 Cookie

1. 在**已登录抖音**的桌面浏览器打开 https://www.douyin.com
2. 用 Cookie 导出插件（如 EditThisCookie / Cookie-Editor）导出 `douyin.com` 的 Cookie，保存为 JSON 文件（数组格式 `[{name, value}, ...]`）
3. Cookie 过期后需要重新导出

## 命令行用法

```bash
# 查自己和好友（uid / 昵称 / 抖音号）
node src/who.js --cookie-file "你的cookie.json"
node src/who.js --cookie-file "你的cookie.json" --name 好友昵称
node src/who.js --cookie-file "你的cookie.json" --json   # 机器可读

# 发一条文本私信（--peer 可以是 uid、昵称或抖音号）
node src/send.js --cookie-file "你的cookie.json" --peer 好友昵称 --text "你好"

# 只编码请求、不真正发送（离线可跑）
node src/send.js --dry-run --self 100 --peer 200 --text hello
```

也可以用环境变量代替文件：`DOUYIN_COOKIE`（原始 Cookie 字符串）、`DOUYIN_SELF_UID`、`DOUYIN_DEVICE_ID`。

给同一好友连续发多条时，可以复用第一次返回的会话参数，省去重复建会话：

```bash
node src/send.js --cookie-file cookie.json --peer 123456 \
  --conversation-id "0:1:xxx" --short-id 998877 --ticket "xxx" --text "第二条"
```

## 网页版 API

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/health` | 健康检查 |
| `POST` | `/api/lookup` | `{ cookie }` → `{ self, friends, pages }` |
| `POST` | `/api/send` | `{ cookie, peer, text, selfUid?, conversationId?, shortId?, ticket?, deviceId?, dryRun? }` → 发送结果 |

`cookie` 接受三种形式：浏览器导出的 JSON 数组、JSON 数组字符串、原始 `name=value; ...` 字符串。

## 工作原理

脚本复刻了抖音 PC 网页端私信（`@pc-im/im`）的 protobuf 协议：

1. `who.js` 调网页接口拿自己的 uid、device id，以及私信关系列表里的好友
   - `GET /aweme/v1/web/user/profile/self/`
   - `GET /aweme/v1/web/im/spotlight/relation/`
2. `send.js` 向 `https://imapi.douyin.com` 发 protobuf 请求
   - `v2/conversation/create`（cmd 609）建 1v1 会话，拿 `conversation_id / shortId / ticket`
   - `v1/message/send`（cmd 100）发文本消息（aweType 700），拿 `serverMessageId`
3. `src/pb.js` 是按实际抓包字段手写的最小 protobuf 编解码器，`src/self-check.js` 可离线验证 roundtrip

脚本依赖当前网页私信协议，抖音更新后可能失效。

## 开发

```bash
npm test        # 离线自检：protobuf roundtrip + who 解析 + send 干跑
npm run web     # 启动网页版
npm run send -- --help
npm run who -- --help
```

## 免责声明

本项目仅供学习与技术交流。请遵守抖音用户协议与相关法律法规，不要用于骚扰、营销群发等行为；
因违反平台规则导致的账号处罚由使用者自行承担。
