const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "runtime");
const RUNTIME_DIR = DATA_DIR;
const STORE_PATH = path.join(RUNTIME_DIR, "password-store.json");

const WORD_BANK = [
  "HEARTH",
  "ARCHIVE",
  "VELVET",
  "LANTERN",
  "PARLOR",
  "CANDLE",
  "OAKEN",
  "ATLAS",
  "EMBER",
  "MANOR",
  "WALNUT",
  "IVORY",
  "GILDED",
  "PARCH",
  "STUDY",
  "MIRROR"
];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function normalizePassword(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeRecord(record) {
  const nextRecord = record && typeof record === "object" ? record : {};
  const nextStatus = ["unused", "active", "used"].includes(nextRecord.status)
    ? nextRecord.status
    : "unused";

  return {
    status: nextStatus,
    deviceId: nextRecord.deviceId || null,
    usedAt: nextRecord.usedAt || null,
    createdAt: nextRecord.createdAt || null,
    source: nextRecord.source || "generated"
  };
}

function normalizeStore(store) {
  if (!store || typeof store !== "object") {
    return {};
  }

  return Object.entries(store).reduce((accumulator, [rawCode, record]) => {
    const code = normalizePassword(rawCode);

    if (!code) {
      return accumulator;
    }

    accumulator[code] = normalizeRecord(record);
    return accumulator;
  }, {});
}

async function ensureStoreFile() {
  await fsp.mkdir(RUNTIME_DIR, { recursive: true });

  try {
    await fsp.access(STORE_PATH, fs.constants.F_OK);
  } catch (error) {
    await fsp.writeFile(STORE_PATH, "{}\n", "utf8");
  }
}

async function readStore() {
  await ensureStoreFile();
  const raw = await fsp.readFile(STORE_PATH, "utf8");
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  return normalizeStore(parsed);
}

async function writeStore(store) {
  await ensureStoreFile();
  await fsp.writeFile(STORE_PATH, `${JSON.stringify(normalizeStore(store), null, 2)}\n`, "utf8");
}

function generatePasswordCode(store) {
  const existingCodes = new Set(Object.keys(store || {}));

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const code = `${word}-${digits}`;

    if (!existingCodes.has(code)) {
      return code;
    }
  }

  return `STUDY-${String(Date.now()).slice(-4)}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(text);
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handleApi(request, response, pathname) {
  if (pathname === "/healthz" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      storePath: STORE_PATH
    });
    return true;
  }

  if (pathname === "/api/passwords" && request.method === "GET") {
    const store = await readStore();
    sendJson(response, 200, { passwords: store });
    return true;
  }

  if (pathname === "/api/passwords" && request.method === "POST") {
    const store = await readStore();
    const code = generatePasswordCode(store);

    store[code] = {
      status: "unused",
      deviceId: null,
      usedAt: null,
      createdAt: new Date().toISOString(),
      source: "generated"
    };

    await writeStore(store);
    sendJson(response, 200, { code, record: store[code], passwords: store });
    return true;
  }

  if (pathname === "/api/passwords/verify" && request.method === "POST") {
    const payload = await readRequestBody(request);
    const passwordCode = normalizePassword(payload.passwordCode);
    const deviceId = String(payload.deviceId || "").trim();
    const store = await readStore();

    if (!passwordCode) {
      sendJson(response, 400, { code: "empty", message: "请先输入测试密码。" });
      return true;
    }

    const record = store[passwordCode];

    if (!record) {
      sendJson(response, 404, { code: "invalid", message: "这个密码当前无效，请核对后再试。" });
      return true;
    }

    if (record.status === "used") {
      sendJson(response, 409, { code: "used", message: "这个密码已经完成过测试，需更换新的有效密码。" });
      return true;
    }

    if (record.deviceId && record.deviceId !== deviceId) {
      sendJson(response, 409, { code: "bound", message: "这个密码已经绑定其他设备，不能在当前浏览器继续测试。" });
      return true;
    }

    record.status = "active";
    record.deviceId = deviceId || record.deviceId || null;
    store[passwordCode] = record;
    await writeStore(store);
    sendJson(response, 200, { message: "验证成功，正在进入名人方向选择。", record });
    return true;
  }

  if (pathname === "/api/passwords/complete" && request.method === "POST") {
    const payload = await readRequestBody(request);
    const passwordCode = normalizePassword(payload.passwordCode);
    const store = await readStore();
    const record = store[passwordCode];

    if (!record) {
      sendJson(response, 404, { code: "missing", message: "密码记录不存在。" });
      return true;
    }

    record.status = "used";
    record.usedAt = new Date().toISOString();
    store[passwordCode] = record;
    await writeStore(store);
    sendJson(response, 200, { record });
    return true;
  }

  return false;
}

async function serveStatic(response, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.resolve(ROOT_DIR, `.${cleanPath}`);

  if (!resolvedPath.startsWith(ROOT_DIR)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(resolvedPath);

    if (stat.isDirectory()) {
      sendText(response, 403, "Forbidden");
      return;
    }

    const extname = path.extname(resolvedPath).toLowerCase();
    const contentType = CONTENT_TYPES[extname] || "application/octet-stream";
    const fileBuffer = await fsp.readFile(resolvedPath);

    response.writeHead(200, {
      "Content-Type": contentType
    });
    response.end(fileBuffer);
  } catch (error) {
    sendText(response, 404, "Not Found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const handledByApi = await handleApi(request, response, url.pathname);

    if (handledByApi) {
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    sendJson(response, 500, {
      code: "server_error",
      message: "服务器发生错误。",
      detail: error.message
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Password server running at http://127.0.0.1:${PORT}`);
  console.log(`Admin page: http://127.0.0.1:${PORT}/password-admin.html`);
  console.log(`Test page: http://127.0.0.1:${PORT}/index.html`);
});
