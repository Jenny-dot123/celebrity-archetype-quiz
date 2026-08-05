(function () {
  const STORAGE_KEYS = {
    deviceId: "celeb_quiz_device_v1",
    session: "celeb_quiz_session_v1",
    passwordStore: "celeb_quiz_password_store_v2"
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
    "MIRROR"
  ];

  function getAppMode() {
    const configuredMode = window.CELEB_QUIZ_APP_CONFIG && window.CELEB_QUIZ_APP_CONFIG.mode;

    if (configuredMode === "static" || configuredMode === "server" || configuredMode === "auto") {
      return configuredMode;
    }

    return "auto";
  }

  function isRemoteMode() {
    const mode = getAppMode();

    if (mode === "static") {
      return false;
    }

    if (mode === "server") {
      return true;
    }

    return window.location.protocol === "http:" || window.location.protocol === "https:";
  }

  function loadJson(key, fallbackValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

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

  function initPasswordStore() {
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

  function getPasswordEntriesFromStore(store) {
    return Object.entries(store)
      .map(([code, record]) => ({
        code,
        record: normalizeRecord(record)
      }))
      .sort((left, right) => {
        const leftTime = left.record.createdAt ? new Date(left.record.createdAt).getTime() : 0;
        const rightTime = right.record.createdAt ? new Date(right.record.createdAt).getTime() : 0;

        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }

        return left.code.localeCompare(right.code);
      });
  }

  function localGeneratePassword() {
    const store = initPasswordStore();
    const code = generatePasswordCode(store);

    store[code] = {
      status: "unused",
      deviceId: null,
      usedAt: null,
      createdAt: new Date().toISOString(),
      source: "generated"
    };

    saveJson(STORAGE_KEYS.passwordStore, store);
    return {
      code,
      record: store[code],
      store
    };
  }

  function localVerifyPassword(passwordCode, deviceId) {
    const store = initPasswordStore();
    const code = normalizePassword(passwordCode);

    if (!code) {
      return { ok: false, code: "empty", message: "请先输入测试密码。" };
    }

    const record = store[code];

    if (!record) {
      return { ok: false, code: "invalid", message: "这个密码当前无效，请核对后再试。" };
    }

    if (record.status === "used") {
      return { ok: false, code: "used", message: "这个密码已经完成过测试，需更换新的有效密码。" };
    }

    if (record.deviceId && record.deviceId !== deviceId) {
      return { ok: false, code: "bound", message: "这个密码已经绑定其他设备，不能在当前浏览器继续测试。" };
    }

    record.status = "active";
    record.deviceId = deviceId;
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
    record.usedAt = new Date().toISOString();
    store[code] = record;
    saveJson(STORAGE_KEYS.passwordStore, store);

    return {
      ok: true,
      code: "ok",
      record
    };
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || "请求失败");
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async function listPasswords() {
    if (!isRemoteMode()) {
      return initPasswordStore();
    }

    const data = await requestJson("/api/passwords");
    return normalizeStore(data.passwords);
  }

  async function addGeneratedPassword() {
    if (!isRemoteMode()) {
      return localGeneratePassword();
    }

    const data = await requestJson("/api/passwords", {
      method: "POST"
    });

    return {
      code: normalizePassword(data.code),
      record: normalizeRecord(data.record),
      store: normalizeStore(data.passwords || {})
    };
  }

  async function getPasswordEntries() {
    const store = await listPasswords();
    return getPasswordEntriesFromStore(store);
  }

  async function verifyPassword(passwordCode, deviceId) {
    if (!isRemoteMode()) {
      return localVerifyPassword(passwordCode, deviceId);
    }

    try {
      const data = await requestJson("/api/passwords/verify", {
        method: "POST",
        body: JSON.stringify({
          passwordCode: normalizePassword(passwordCode),
          deviceId
        })
      });

      return {
        ok: true,
        code: "ok",
        message: data.message || "验证成功，正在进入名人方向选择。",
        record: normalizeRecord(data.record)
      };
    } catch (error) {
      return {
        ok: false,
        code: error.data?.code || "network_error",
        message: error.data?.message || "验证失败，请稍后再试。"
      };
    }
  }

  async function markPasswordUsed(passwordCode) {
    if (!isRemoteMode()) {
      return localMarkPasswordUsed(passwordCode);
    }

    try {
      const data = await requestJson("/api/passwords/complete", {
        method: "POST",
        body: JSON.stringify({
          passwordCode: normalizePassword(passwordCode)
        })
      });

      return {
        ok: true,
        code: "ok",
        record: normalizeRecord(data.record)
      };
    } catch (error) {
      return {
        ok: false,
        code: error.data?.code || "network_error",
        message: error.data?.message || "作废密码时发生错误。"
      };
    }
  }

  window.CELEB_QUIZ_PASSWORDS = {
    STORAGE_KEYS,
    isRemoteMode,
    loadJson,
    saveJson,
    normalizePassword,
    initPasswordStore,
    listPasswords,
    addGeneratedPassword,
    getPasswordEntries,
    verifyPassword,
    markPasswordUsed
  };
})();
