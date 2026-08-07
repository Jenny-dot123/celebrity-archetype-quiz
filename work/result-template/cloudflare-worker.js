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

function rowToEntry(row) {
  if (!row) {
    return null;
  }

  return {
    code: normalizePassword(row.code),
    record: normalizeRecord({
      status: row.status,
      deviceId: row.device_id,
      usedAt: row.used_at,
      createdAt: row.created_at,
      source: row.source
    })
  };
}

function entriesToStore(entries) {
  return entries.reduce((accumulator, entry) => {
    if (entry && entry.code) {
      accumulator[entry.code] = entry.record;
    }

    return accumulator;
  }, {});
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return {};
  }
}

function nowIso() {
  return new Date().toISOString();
}

function generatePasswordCode() {
  const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `${word}-${digits}`;
}

async function ensureDatabase(env) {
  if (!env.DB) {
    return jsonResponse({
      ok: false,
      code: "db_not_configured",
      message: "Cloudflare D1 database is not configured yet."
    }, 503);
  }

  return null;
}

async function listPasswordEntries(env) {
  const result = await env.DB.prepare(`
    SELECT code, status, device_id, used_at, created_at, source
    FROM passwords
    ORDER BY datetime(created_at) DESC, code ASC
  `).all();

  return (result.results || []).map(rowToEntry).filter(Boolean);
}

async function findPassword(env, code) {
  const result = await env.DB.prepare(`
    SELECT code, status, device_id, used_at, created_at, source
    FROM passwords
    WHERE code = ?
    LIMIT 1
  `).bind(code).first();

  return rowToEntry(result);
}

async function generateUniquePassword(env) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const code = generatePasswordCode();
    const exists = await env.DB.prepare("SELECT code FROM passwords WHERE code = ? LIMIT 1")
      .bind(code)
      .first();

    if (!exists) {
      return code;
    }
  }

  return `STUDY-${String(Date.now()).slice(-4)}`;
}

async function handleApi(request, env, pathname) {
  const dbError = await ensureDatabase(env);

  if (dbError) {
    return dbError;
  }

  if (pathname === "/healthz" && request.method === "GET") {
    return jsonResponse({
      ok: true,
      storage: "cloudflare-d1"
    });
  }

  if (pathname === "/api/passwords" && request.method === "GET") {
    const entries = await listPasswordEntries(env);
    return jsonResponse({ passwords: entriesToStore(entries) });
  }

  if (pathname === "/api/passwords" && request.method === "POST") {
    const code = await generateUniquePassword(env);
    const createdAt = nowIso();

    await env.DB.prepare(`
      INSERT INTO passwords (code, status, device_id, used_at, created_at, source)
      VALUES (?, 'unused', NULL, NULL, ?, 'generated')
    `).bind(code, createdAt).run();

    const entry = await findPassword(env, code);
    const entries = await listPasswordEntries(env);
    return jsonResponse({
      code,
      record: entry ? entry.record : null,
      passwords: entriesToStore(entries)
    });
  }

  if (pathname === "/api/passwords/verify" && request.method === "POST") {
    const payload = await readJson(request);
    const passwordCode = normalizePassword(payload.passwordCode);
    const deviceId = String(payload.deviceId || "").trim();

    if (!passwordCode) {
      return jsonResponse({
        code: "empty",
        message: "请先输入测试密码。"
      }, 400);
    }

    const entry = await findPassword(env, passwordCode);

    if (!entry) {
      return jsonResponse({
        code: "invalid",
        message: "这个密码当前无效，请核对后再试。"
      }, 404);
    }

    if (entry.record.status === "used") {
      return jsonResponse({
        code: "used",
        message: "这个密码已经完成过测试，需要更换新的有效密码。"
      }, 409);
    }

    if (entry.record.deviceId && entry.record.deviceId !== deviceId) {
      return jsonResponse({
        code: "bound",
        message: "这个密码已经绑定其他设备，不能在当前浏览器继续测试。"
      }, 409);
    }

    await env.DB.prepare(`
      UPDATE passwords
      SET status = 'active',
          device_id = ?
      WHERE code = ?
    `).bind(deviceId || entry.record.deviceId || null, passwordCode).run();

    const updated = await findPassword(env, passwordCode);
    return jsonResponse({
      message: "验证成功，正在进入名人方向选择。",
      record: updated ? updated.record : null
    });
  }

  if (pathname === "/api/passwords/complete" && request.method === "POST") {
    const payload = await readJson(request);
    const passwordCode = normalizePassword(payload.passwordCode);

    if (!passwordCode) {
      return jsonResponse({
        code: "missing",
        message: "密码记录不存在。"
      }, 404);
    }

    const entry = await findPassword(env, passwordCode);

    if (!entry) {
      return jsonResponse({
        code: "missing",
        message: "密码记录不存在。"
      }, 404);
    }

    await env.DB.prepare(`
      UPDATE passwords
      SET status = 'used',
          used_at = ?
      WHERE code = ?
    `).bind(nowIso(), passwordCode).run();

    const updated = await findPassword(env, passwordCode);
    return jsonResponse({
      record: updated ? updated.record : null
    });
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz" || url.pathname.startsWith("/api/")) {
      const response = await handleApi(request, env, url.pathname);

      if (response) {
        return response;
      }

      return jsonResponse({
        code: "not_found",
        message: "API endpoint not found."
      }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};
