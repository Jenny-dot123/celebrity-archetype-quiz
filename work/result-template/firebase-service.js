const DEFAULT_SDK_VERSION = "11.10.0";
const REQUIRED_KEYS = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
const PLACEHOLDER_TOKENS = ["YOUR_", "REPLACE_", "EXAMPLE", "FILL_", "TODO"];

const state = {
  servicesPromise: null,
  initialAuthPromise: null
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

export function getFirebaseConfig() {
  const rawConfig = window.CELEB_QUIZ_FIREBASE_CONFIG || {};

  return {
    sdkVersion: rawConfig.sdkVersion || DEFAULT_SDK_VERSION,
    apiKey: rawConfig.apiKey || "",
    authDomain: rawConfig.authDomain || "",
    databaseURL: rawConfig.databaseURL || "",
    projectId: rawConfig.projectId || "",
    storageBucket: rawConfig.storageBucket || "",
    messagingSenderId: rawConfig.messagingSenderId || "",
    appId: rawConfig.appId || ""
  };
}

export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return REQUIRED_KEYS.every((key) => valueLooksConfigured(config[key]));
}

export function isFirebaseSupportedEnvironment() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

export function getFirebaseSetupMessage() {
  if (!isFirebaseSupportedEnvironment()) {
    return "正式发码版不能直接双击本地 HTML 文件打开，请通过 Firebase Hosting 链接或本地服务器访问。";
  }

  if (!isFirebaseConfigured()) {
    return "还没有完成 Firebase 配置，请先把 firebase-app-config.js 里的项目参数填写完整。";
  }

  return "";
}

async function loadFirebaseModules(version) {
  const base = `https://www.gstatic.com/firebasejs/${version}`;

  return Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-database.js`)
  ]);
}

function waitForInitialAuth(services) {
  if (!state.initialAuthPromise) {
    state.initialAuthPromise = new Promise((resolve) => {
      const unsubscribe = services.onAuthStateChanged(services.auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  return state.initialAuthPromise;
}

export async function getFirebaseServices() {
  if (!isFirebaseConfigured() || !isFirebaseSupportedEnvironment()) {
    throw new Error(getFirebaseSetupMessage());
  }

  if (!state.servicesPromise) {
    state.servicesPromise = (async () => {
      const config = getFirebaseConfig();
      const [appModule, authModule, databaseModule] = await loadFirebaseModules(config.sdkVersion);
      const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);
      const auth = authModule.getAuth(app);

      await authModule.setPersistence(auth, authModule.browserLocalPersistence);

      return {
        ...appModule,
        ...authModule,
        ...databaseModule,
        app,
        auth,
        db: databaseModule.getDatabase(app)
      };
    })().catch((error) => {
      state.servicesPromise = null;
      state.initialAuthPromise = null;
      throw error;
    });
  }

  const services = await state.servicesPromise;
  await waitForInitialAuth(services);
  return services;
}

export async function getCurrentUser() {
  const services = await getFirebaseServices();
  return services.auth.currentUser;
}

export async function ensureQuizAuthSession() {
  const services = await getFirebaseServices();

  if (services.auth.currentUser) {
    return services.auth.currentUser;
  }

  await services.signInAnonymously(services.auth);
  return services.auth.currentUser;
}

export async function signOutCurrentUser() {
  const services = await getFirebaseServices();
  return services.signOut(services.auth);
}

export async function isCurrentUserAdmin(userId) {
  if (!userId) {
    return false;
  }

  const services = await getFirebaseServices();
  const snapshot = await services.get(services.ref(services.db, `admins/${userId}`));
  return snapshot.exists() && snapshot.val() === true;
}

export async function claimAdminAccess() {
  const services = await getFirebaseServices();
  const user = services.auth.currentUser;

  if (!user) {
    throw new Error("请先登录管理员账号。");
  }

  await services.set(services.ref(services.db, `admins/${user.uid}`), true);
  return true;
}

export async function onAuthStateResolved(callback) {
  const services = await getFirebaseServices();

  return services.onAuthStateChanged(services.auth, async (user) => {
    let isAdmin = false;

    if (user) {
      try {
        isAdmin = await isCurrentUserAdmin(user.uid);
      } catch (error) {
        isAdmin = false;
      }
    }

    callback({
      user,
      isAdmin
    });
  });
}
