const DEFAULT_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
const PLACEHOLDER_TOKENS = ["YOUR_", "REPLACE_", "EXAMPLE", "FILL_", "TODO"];

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

export function getSupabaseConfig() {
  const rawConfig = window.CELEB_QUIZ_SUPABASE_CONFIG || {};

  return {
    sdkUrl: rawConfig.sdkUrl || DEFAULT_SDK_URL,
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

async function loadSupabaseModule() {
  const { sdkUrl } = getSupabaseConfig();
  return import(sdkUrl);
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured() || !isSupabaseSupportedEnvironment()) {
    throw new Error(getSupabaseSetupMessage());
  }

  if (!state.clientPromise) {
    state.clientPromise = (async () => {
      const config = getSupabaseConfig();
      const module = await loadSupabaseModule();

      return module.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "celeb_quiz_supabase_auth_v1"
        },
        global: {
          headers: {
            "X-Client-Info": "celebrity-archetype-quiz"
          }
        }
      });
    })().catch((error) => {
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

  const emit = async (session) => {
    const user = session?.user || null;
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
  };

  const initialSession = await client.auth.getSession();
  await emit(initialSession.data.session || null);

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    emit(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
