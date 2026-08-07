import {
  claimAdminAccess,
  ensureQuizAuthSession,
  getCurrentUser,
  getSupabaseClient,
  getSupabaseSetupMessage,
  isCurrentUserAdmin,
  isSupabaseConfigured,
  isSupabaseSupportedEnvironment
} from "./supabase-service.js";

export const STORAGE_KEYS = {
  deviceId: "celeb_quiz_device_v1",
  session: "celeb_quiz_session_v1",
  passwordStore: "celeb_quiz_password_store_v4"
};

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
  "MIRROR",
  "AURORA",
  "COPPER",
  "MAPLE",
  "VIOLET",
  "CEDAR",
  "HARBOR",
  "QUILL",
  "MEADOW",
  "SILVER",
  "POETRY",
  "BRIAR",
  "CASCADE",
  "MARBLE",
  "RIBBON",
  "WINDOW",
  "VOYAGE"
];

export function getAppMode() {
  const configuredMode = window.CELEB_QUIZ_APP_CONFIG && window.CELEB_QUIZ_APP_CONFIG.mode;

  if (configuredMode === "static" || configuredMode === "server" || configuredMode === "auto") {
    return configuredMode;
  }

  return "auto";
}

export function isRemoteMode() {
  const mode = getAppMode();

  if (mode === "static") {
    return false;
  }

  if (mode === "server") {
    return true;
  }

  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export function isRemoteBackendReady() {
  if (!isRemoteMode()) {
    return false;
  }

  return isSupabaseConfigured() && isSupabaseSupportedEnvironment();
}

export function getRemoteSetupMessage() {
  if (!isRemoteMode()) {
    return "";
  }

  return getSupabaseSetupMessage();
}

export function loadJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function normalizePassword(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeRecord(record) {
  const nextRecord = record && typeof record === "object" ? record : {};
  const nextStatus = ["unused", "active", "used"].includes(nextRecord.status)
    ? nextRecord.status
    : "unused";

  return {
    status: nextStatus,
    authUid: nextRecord.authUid || nextRecord.auth_uid || "",
    usedAt: Number(nextRecord.usedAt || nextRecord.used_at || 0),
    activatedAt: Number(nextRecord.activatedAt || nextRecord.activated_at || 0),
    createdAt: Number(nextRecord.createdAt || nextRecord.created_at || 0),
    createdBy: nextRecord.createdBy || nextRecord.created_by || "",
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

export function initPasswordStore() {
  if (isRemoteMode()) {
    return {};
  }

  const stored = loadJson(STORAGE_KEYS.passwordStore, {});
  const normalizedStore = normalizeStore(stored);
  saveJson(STORAGE_KEYS.passwordStore, normalizedStore);
  return normalizedStore;
}

function generatePasswordCode(store) {
  const existingCodes = new Set(Object.keys(store || {}));

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const left = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const right = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const code = `${left}-${right}-${digits}`;

    if (!existingCodes.has(code)) {
      return code;
    }
  }

  return `ARCHIVE-${Date.now()}`;
}

function getPasswordEntriesFromStore(store) {
  return Object.entries(store)
    .map(([code, record]) => ({
      code,
      record: normalizeRecord(record)
    }))
    .sort((left, right) => {
      if (left.record.createdAt !== right.record.createdAt) {
        return right.record.createdAt - left.record.createdAt;
      }

      return left.code.localeCompare(right.code);
    });
}

function localGeneratePassword() {
  const store = initPasswordStore();
  const code = generatePasswordCode(store);
  const deviceId = localStorage.getItem(STORAGE_KEYS.deviceId) || "";

  store[code] = {
    status: "unused",
    authUid: "",
    usedAt: 0,
    activatedAt: 0,
    createdAt: Date.now(),
    createdBy: deviceId || "local",
    source: "generated"
  };

  saveJson(STORAGE_KEYS.passwordStore, store);
  return {
    code,
    record: store[code]
  };
}

function localVerifyPassword(passwordCode) {
  const store = initPasswordStore();
  const code = normalizePassword(passwordCode);
  const deviceId = localStorage.getItem(STORAGE_KEYS.deviceId) || "";

  if (!code) {
    return { ok: false, code: "empty", message: "请先输入测试密码。" };
  }

  const record = store[code];

  if (!record) {
    return { ok: false, code: "invalid", message: "这个密码当前无效，请核对后再试。" };
  }

  if (record.status === "used") {
    return { ok: false, code: "used", message: "这个密码已经完成过测试，需要更换新的有效密码。" };
  }

  if (record.authUid && record.authUid !== deviceId) {
    return { ok: false, code: "bound", message: "这个密码已经绑定到其他设备，不能在当前浏览器继续。" };
  }

  record.status = "active";
  record.authUid = deviceId;
  record.activatedAt = record.activatedAt || Date.now();
  store[code] = record;
  saveJson(STORAGE_KEYS.passwordStore, store);

  return {
    ok: true,
    code: "ok",
    message: "验证成功，正在进入名人方向选择。",
    record
  };
}

function localMarkPasswordUsed(passwordCode) {
  const store = initPasswordStore();
  const code = normalizePassword(passwordCode);
  const record = store[code];

  if (!record) {
    return { ok: false, code: "missing", message: "密码记录不存在。" };
  }

  record.status = "used";
  record.usedAt = record.usedAt || Date.now();
  store[code] = record;
  saveJson(STORAGE_KEYS.passwordStore, store);

  return {
    ok: true,
    code: "ok",
    record
  };
}

async function requireAdminUser() {
  if (!isRemoteBackendReady()) {
    throw new Error(getRemoteSetupMessage());
  }

  const user = await getCurrentUser();

  if (!user) {
    throw new Error("请先在密码管理页建立管理员身份。");
  }

  const isAdmin = await isCurrentUserAdmin(user.id);

  if (!isAdmin) {
    throw new Error("当前浏览器还没有管理员权限，请先在密码管理页领取管理员身份。");
  }

  return user;
}

async function callRpc(functionName, args = {}) {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc(functionName, args);

  if (error) {
    throw error;
  }

  return data;
}

async function listRemotePasswords() {
  await requireAdminUser();
  const rows = await callRpc("list_passwords");

  return (rows || []).reduce((accumulator, row) => {
    const code = normalizePassword(row.code);

    if (!code) {
      return accumulator;
    }

    accumulator[code] = normalizeRecord(row);
    return accumulator;
  }, {});
}

async function createRemotePassword() {
  await requireAdminUser();
  const row = await callRpc("create_password_code");

  return {
    code: normalizePassword(row.code),
    record: normalizeRecord(row)
  };
}

function buildVerifyResponseFromPayload(payload) {
  const nextPayload = payload && typeof payload === "object" ? payload : {};

  return {
    ok: Boolean(nextPayload.ok),
    code: nextPayload.code || "invalid",
    message: nextPayload.message || "验证失败，请稍后再试。",
    record: nextPayload.record ? normalizeRecord(nextPayload.record) : null
  };
}

async function verifyRemotePassword(passwordCode) {
  if (!isRemoteBackendReady()) {
    return { ok: false, code: "setup_required", message: getRemoteSetupMessage() };
  }

  const code = normalizePassword(passwordCode);

  if (!code) {
    return { ok: false, code: "empty", message: "请先输入测试密码。" };
  }

  await ensureQuizAuthSession();
  const payload = await callRpc("verify_password_code", {
    input_code: code
  });

  return buildVerifyResponseFromPayload(payload);
}

async function completeRemotePassword(passwordCode) {
  if (!isRemoteBackendReady()) {
    return { ok: false, code: "setup_required", message: getRemoteSetupMessage() };
  }

  const code = normalizePassword(passwordCode);

  if (!code) {
    return { ok: false, code: "missing", message: "密码记录不存在。" };
  }

  await ensureQuizAuthSession();
  const payload = await callRpc("complete_password_code", {
    input_code: code
  });

  return buildVerifyResponseFromPayload(payload);
}

export async function listPasswords() {
  if (!isRemoteMode()) {
    return initPasswordStore();
  }

  return listRemotePasswords();
}

export async function addGeneratedPassword() {
  if (!isRemoteMode()) {
    return localGeneratePassword();
  }

  return createRemotePassword();
}

export async function getPasswordEntries() {
  const store = await listPasswords();
  return getPasswordEntriesFromStore(store);
}

export async function verifyPassword(passwordCode) {
  if (!isRemoteMode()) {
    return localVerifyPassword(passwordCode);
  }

  try {
    return await verifyRemotePassword(passwordCode);
  } catch (error) {
    return {
      ok: false,
      code: "network_error",
      message: error.message || "验证失败，请稍后再试。"
    };
  }
}

export async function markPasswordUsed(passwordCode) {
  if (!isRemoteMode()) {
    return localMarkPasswordUsed(passwordCode);
  }

  try {
    return await completeRemotePassword(passwordCode);
  } catch (error) {
    return {
      ok: false,
      code: "network_error",
      message: error.message || "作废密码时发生错误。"
    };
  }
}

export { claimAdminAccess };
