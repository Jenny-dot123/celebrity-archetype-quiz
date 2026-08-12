const PLACEHOLDER_TOKENS = ["YOUR_", "REPLACE_", "EXAMPLE", "FILL_", "TODO"];
const QUIZ_STORAGE_KEY = "celeb_quiz_supabase_session_v1";
const ADMIN_STORAGE_KEY = "celeb_quiz_supabase_admin_session_v1";

function getSessionStorageKey() {
  return /(?:^|\/)password-admin\.html$/i.test(window.location.pathname)
    ? ADMIN_STORAGE_KEY
    : QUIZ_STORAGE_KEY;
}

const state = {
  clientPromise: null
};

function valueLooksConfigured(value) {
  if (!value) {
    return false;
  }

  const normalized = String(value).trim();

  if (!normalized) {
    return false;
  }

  return !PLACEHOLDER_TOKENS.some((token) => normalized.toUpperCase().includes(token));
}

function getProjectLabel(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(".supabase.co", "");
  } catch (error) {
    return "未填写";
  }
}

function loadStoredSession() {
  try {
    const raw = localStorage.getItem(getSessionStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveStoredSession(session) {
  if (!session) {
    localStorage.removeItem(getSessionStorageKey());
    return;
  }

  localStorage.setItem(getSessionStorageKey(), JSON.stringify(session));
}

function getStoredToken() {
  const session = loadStoredSession();
  return session?.access_token || "";
}

function getStoredRefreshToken() {
  const session = loadStoredSession();
  return session?.refresh_token || "";
}

function isSessionExpired(session) {
  if (!session?.expires_at) {
    return false;
  }

  return Date.now() >= Number(session.expires_at) * 1000;
}

function buildHeaders(config, token) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${token || config.anonKey}`,
    "Content-Type": "application/json"
  };
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseResponse(response);

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.msg || payload?.message || payload?.error_description || payload?.error || "请求失败";

    throw new Error(message);
  }

  return payload;
}

function translateAuthError(message) {
  const normalized = String(message || "").toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "QQ 邮箱或管理员密码不正确。";
  }

  if (normalized.includes("email not confirmed")) {
    return "这个 QQ 邮箱还没有完成确认，请在 Supabase 用户列表中确认该账号。";
  }

  if (normalized.includes("email logins are disabled")) {
    return "Supabase 还没有开启邮箱登录，请先启用 Email 登录。";
  }

  return message;
}

function normalizeSession(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const user = payload.user || null;
  const accessToken = payload.access_token || "";
  const refreshToken = payload.refresh_token || "";
  const expiresIn = Number(payload.expires_in || 3600);
  const expiresAt = payload.expires_at || Math.floor(Date.now() / 1000) + expiresIn;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    token_type: payload.token_type || "bearer",
    user
  };
}

async function refreshSession(config, refreshToken) {
  if (!refreshToken) {
    return null;
  }

  const payload = await requestJson(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const session = normalizeSession(payload);

  if (session) {
    saveStoredSession(session);
  }

  return session;
}

async function signInAnonymouslyViaRest(config) {
  const attempts = [
    { data: {} },
    {}
  ];

  for (const body of attempts) {
    try {
      const payload = await requestJson(`${config.url}/auth/v1/signup`, {
        method: "POST",
        headers: buildHeaders(config),
        body: JSON.stringify(body)
      });

      const session = normalizeSession(payload);

      if (!session?.access_token) {
        continue;
      }

      saveStoredSession(session);
      return session;
    } catch (error) {
      if (body !== attempts[attempts.length - 1]) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("匿名身份创建失败，请确认 Supabase 已开启 Anonymous Sign-Ins。");
}

async function signInWithPasswordViaRest(config, email, password) {
  let payload;

  try {
    payload = await requestJson(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        email: String(email || "").trim().toLowerCase(),
        password: String(password || "")
      })
    });
  } catch (error) {
    throw new Error(translateAuthError(error?.message || "登录失败。"));
  }
  const session = normalizeSession(payload);

  if (!session?.access_token) {
    throw new Error("登录失败，请检查 QQ 邮箱和管理员密码。");
  }

  saveStoredSession(session);
  return session;
}

async function getCurrentSession(config) {
  const storedSession = loadStoredSession();

  if (storedSession?.access_token && !isSessionExpired(storedSession)) {
    return storedSession;
  }

  const refreshToken = storedSession?.refresh_token || getStoredRefreshToken();

  if (refreshToken) {
    try {
      const refreshed = await refreshSession(config, refreshToken);

      if (refreshed) {
        return refreshed;
      }
    } catch (error) {
      saveStoredSession(null);
      throw error;
    }
  }

  return null;
}

export function getSupabaseConfig() {
  const rawConfig = window.CELEB_QUIZ_SUPABASE_CONFIG || {};

  return {
    url: rawConfig.url || "",
    anonKey: rawConfig.anonKey || "",
    projectLabel: rawConfig.projectLabel || getProjectLabel(rawConfig.url || "")
  };
}

export function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return valueLooksConfigured(config.url) && valueLooksConfigured(config.anonKey);
}

export function isSupabaseSupportedEnvironment() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export function getSupabaseSetupMessage() {
  if (!isSupabaseSupportedEnvironment()) {
    return "正式发码版不能直接双击本地 HTML 文件打开。你可以本地预览静态演示版，真正发码请通过公开链接或本地服务器访问。";
  }

  if (!isSupabaseConfigured()) {
    return "还没有完成 Supabase 配置，请先把 supabase-app-config.js 里的 url 和 anonKey 填写完整。";
  }

  return "";
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured() || !isSupabaseSupportedEnvironment()) {
    throw new Error(getSupabaseSetupMessage());
  }

  if (!state.clientPromise) {
    state.clientPromise = Promise.resolve({
      auth: {
        async getSession() {
          const config = getSupabaseConfig();
          const session = await getCurrentSession(config);

          return { data: { session }, error: null };
        },
        async getUser() {
          const config = getSupabaseConfig();
          const session = await getCurrentSession(config);

          if (!session?.access_token) {
            return { data: { user: null }, error: new Error("No active session") };
          }

          const payload = await requestJson(`${config.url}/auth/v1/user`, {
            method: "GET",
            headers: buildHeaders(config, session.access_token)
          });

          return { data: { user: payload }, error: null };
        },
        async signInAnonymously() {
          const config = getSupabaseConfig();
          const session = await signInAnonymouslyViaRest(config);
          return { data: { session, user: session.user }, error: null };
        },
        async signInWithPassword(credentials) {
          const config = getSupabaseConfig();
          const session = await signInWithPasswordViaRest(
            config,
            credentials?.email,
            credentials?.password
          );
          return { data: { session, user: session.user }, error: null };
        },
        async signOut() {
          saveStoredSession(null);
          return { error: null };
        }
      },
      async rpc(functionName, args = {}) {
        const config = getSupabaseConfig();
        const session = await getCurrentSession(config);

        if (!session?.access_token) {
          throw new Error("当前浏览器没有有效登录会话，请重新进入后再试。");
        }

        const payload = await requestJson(`${config.url}/rest/v1/rpc/${functionName}`, {
          method: "POST",
          headers: buildHeaders(config, session.access_token),
          body: JSON.stringify(args)
        });

        return { data: payload, error: null };
      }
    }).catch((error) => {
      state.clientPromise = null;
      throw error;
    });
  }

  return state.clientPromise;
}

export async function getCurrentUser() {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user || null;
}

export async function ensureQuizAuthSession() {
  const client = await getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (sessionData.session?.user) {
    return sessionData.session.user;
  }

  const { data, error } = await client.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  return data.user || data.session?.user || null;
}

export async function getSignedInUser() {
  const client = await getSupabaseClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!sessionData.session?.access_token) {
    return null;
  }

  const { data, error } = await client.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user || null;
}

export async function signInAdminWithPassword(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!/^\S+@qq\.com$/i.test(normalizedEmail)) {
    throw new Error("请输入完整的 QQ 邮箱，例如 123456@qq.com。");
  }

  if (!password) {
    throw new Error("请输入管理员密码。");
  }

  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    throw error;
  }

  return data.user || data.session?.user || null;
}

export async function signOutCurrentUser() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();

  if (error) {
    throw error;
  }

  return true;
}

export async function getAdminStatus() {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("get_admin_status");

  if (error) {
    throw error;
  }

  return {
    isAdmin: Boolean(data?.is_admin),
    adminClaimed: Boolean(data?.admin_claimed),
    claimedByCurrentUser: Boolean(data?.claimed_by_current_user)
  };
}

export async function isCurrentUserAdmin() {
  const status = await getAdminStatus();
  return status.isAdmin;
}

export async function claimAdminAccess() {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("claim_admin_access");

  if (error) {
    throw error;
  }

  return data;
}

export async function onAuthStateResolved(callback) {
  const client = await getSupabaseClient();
  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData?.session?.user || null;

  let status = {
    isAdmin: false,
    adminClaimed: false,
    claimedByCurrentUser: false
  };

  if (user) {
    try {
      status = await getAdminStatus();
    } catch (error) {
      status = {
        isAdmin: false,
        adminClaimed: false,
        claimedByCurrentUser: false
      };
    }
  }

  callback({
    user,
    isAdmin: status.isAdmin,
    adminClaimed: status.adminClaimed,
    claimedByCurrentUser: status.claimedByCurrentUser
  });

  return () => {};
}
