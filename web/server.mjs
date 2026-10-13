#!/usr/bin/env node
// 零依赖网页版：粘贴 Cookie → 查好友 → 发私信。
// Cookie 只在内存里流转：不写磁盘、不记日志、不做任何持久化。

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cookieHeaderFromItems } from "../src/cookies.js";
import { loadSelfAndRelations } from "../src/who.js";
import { sendTextMessage } from "../src/send.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "public");
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 512 * 1024;

// 接受三种 Cookie 输入：
// 1. 浏览器导出的 JSON 数组 [{name, value}, ...]
// 2. JSON 数组的字符串形式（直接粘贴导出文件内容）
// 3. 原始 Cookie header 字符串（name=value; name2=value2）
function normalizeCookie(input) {
  if (Array.isArray(input)) return cookieHeaderFromItems(input);
  const text = String(input || "").trim();
  if (!text) return "";
  if (text.startsWith("[")) return cookieHeaderFromItems(JSON.parse(text));
  return text;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await readFile(join(ROOT, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/lookup") {
      const body = await readJsonBody(req);
      const cookie = normalizeCookie(body.cookie);
      if (!cookie) {
        json(res, 400, { ok: false, error: "缺少 cookie：粘贴 Cookie 字符串或浏览器导出的 JSON 数组" });
        return;
      }
      const loaded = await loadSelfAndRelations(cookie, "https://www.douyin.com", 10);
      if (!loaded.self) {
        json(res, 502, {
          ok: false,
          error: `读取失败：HTTP ${loaded.httpStatus} status_code=${loaded.profileStatus} ${loaded.profileMessage || ""}（Cookie 可能已过期）`,
        });
        return;
      }
      json(res, 200, {
        ok: true,
        self: loaded.self,
        friends: loaded.people.map((p) => ({ uid: p.uid, nickname: p.nickname, uniqueId: p.uniqueId })),
        pages: loaded.pages,
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/send") {
      const body = await readJsonBody(req);
      const cookie = normalizeCookie(body.cookie);
      const logs = [];
      const result = await sendTextMessage({
        cookie,
        peer: String(body.peer || ""),
        text: String(body.text || ""),
        selfUid: String(body.selfUid || ""),
        conversationId: String(body.conversationId || ""),
        shortId: String(body.shortId || ""),
        ticket: String(body.ticket || ""),
        deviceId: String(body.deviceId || ""),
        dryRun: body.dryRun === true,
        log: (message) => logs.push(String(message)),
      });
      json(res, 200, {
        ok: true,
        logs,
        result: {
          dryRun: !!result.dryRun,
          selfUid: result.selfUid,
          peerUid: result.peerUid,
          conversationId: result.conversationId,
          shortId: result.shortId,
          ticket: result.ticket || "",
          clientId: result.clientId,
          serverMessageId: result.serverMessageId,
        },
      });
      return;
    }

    json(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    json(res, 500, { ok: false, error: error.message || "服务器错误" });
  }
});

server.listen(PORT, () => {
  console.log(`douyin-im-send web  listening on http://localhost:${PORT}`);
});
