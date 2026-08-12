import * as passwordService from "./password-store.js?v=20260811-release-d";
import {
  getAdminStatus,
  getSignedInUser,
  getSupabaseConfig,
  getSupabaseSetupMessage,
  isSupabaseConfigured,
  isSupabaseSupportedEnvironment,
  signInAdminWithPassword,
  signOutCurrentUser
} from "./supabase-service.js?v=20260812-mobile-admin";

const testEntryUrl = new URL("./index.html?v=20260811-release-d", window.location.href).toString();

const elements = {
  generatePassword: document.getElementById("generate-password"),
  copyLatestPassword: document.getElementById("copy-latest-password"),
  copySendText: document.getElementById("copy-send-text"),
  adminLead: document.getElementById("admin-lead"),
  adminHelper: document.getElementById("admin-helper"),
  adminModeNote: document.getElementById("admin-mode-note"),
  adminListNote: document.getElementById("admin-list-note"),
  latestPassword: document.getElementById("latest-password"),
  latestMeta: document.getElementById("latest-meta"),
  openTestEntry: document.getElementById("open-test-entry"),
  copyTestLink: document.getElementById("copy-test-link"),
  countUnused: document.getElementById("count-unused"),
  countActive: document.getElementById("count-active"),
  countUsed: document.getElementById("count-used"),
  passwordList: document.getElementById("password-list"),
  toast: document.getElementById("toast"),
  authState: document.getElementById("auth-state"),
  authEmail: document.getElementById("auth-email"),
  authHint: document.getElementById("auth-hint"),
  authProject: document.getElementById("auth-project"),
  loginForm: document.getElementById("admin-login-form"),
  adminEmailInput: document.getElementById("admin-email"),
  adminPasswordInput: document.getElementById("admin-password"),
  authSignIn: document.getElementById("auth-sign-in"),
  authSignOut: document.getElementById("auth-sign-out"),
  guideList: document.getElementById("admin-guide-list")
};

const state = {
  entries: [],
  latestEntry: null,
  currentUser: null,
  isAdmin: false,
  isSigningIn: false,
  isGenerating: false,
  toastTimer: null
};

bindEvents();
renderStaticShell();
init();

function bindEvents() {
  elements.generatePassword.addEventListener("click", handleGeneratePassword);
  elements.copyLatestPassword.addEventListener("click", handleCopyLatestPassword);
  elements.copySendText.addEventListener("click", handleCopySendText);
  elements.copyTestLink.addEventListener("click", () => {
    copyText(testEntryUrl, "测试入口链接已复制");
  });
  elements.openTestEntry.addEventListener("click", () => {
    window.open(testEntryUrl, "_blank", "noopener");
  });
  elements.loginForm.addEventListener("submit", handleAdminSignIn);
  elements.authSignOut.addEventListener("click", handleAdminSignOut);
}

async function init() {
  if (!passwordService.isRemoteMode()) {
    await refreshEntries();
    return;
  }

  if (!passwordService.isRemoteBackendReady()) {
    renderRemoteSetupState();
    return;
  }

  const config = getSupabaseConfig();
  elements.authProject.textContent = config.projectLabel || "未填写";

  try {
    const user = await getSignedInUser();
    const adminStatus = user ? await getAdminStatus() : null;
    applyAdminStatus(user, adminStatus);
    renderAuthCard();

    if (state.isAdmin) {
      await refreshEntries();
    } else {
      renderLatest(null);
      renderStats([]);
      renderLockedList();
    }
  } catch (error) {
    elements.authState.textContent = "进入失败";
    elements.authEmail.textContent = "还没有登录管理员账号";
    elements.authHint.textContent = getFriendlyError(error, "管理员登录状态读取失败，请稍后再试。");
    elements.authSignIn.disabled = false;
    elements.authSignOut.disabled = true;
  }
}

function applyAdminStatus(user, adminStatus) {
  state.currentUser = user || null;
  state.isAdmin = Boolean(adminStatus?.isAdmin);
}

function renderStaticShell() {
  elements.authSignOut.style.display = "none";

  if (!passwordService.isRemoteMode()) {
    elements.copySendText.textContent = "复制操作说明";
    elements.adminLead.textContent = "这里用于生成测试密码，并管理当前浏览器里的密码记录。静态版密码只保存在当前浏览器，更适合你自己演示流程。";
    elements.adminHelper.textContent = "真正上线后，页面会自动切到正式发码模式；你现在本地双击也能继续预览。";
    elements.adminModeNote.textContent = "当前是本地静态模式，密码不会同步到别人的设备。";
    elements.adminListNote.textContent = "到达结果页后，该密码会在当前浏览器里作废。";
    elements.authState.textContent = "静态模式";
    elements.authEmail.textContent = "当前不需要管理员登录";
    elements.authHint.textContent = "这只适合本机演示，不适合正式发码。";
    elements.loginForm.hidden = true;
    elements.guideList.innerHTML = [
      "1. 点击“生成一个新密码”。",
      "2. 打开测试入口，输入刚生成的密码。",
      "3. 在同一浏览器里走完整个流程。"
    ].map((item) => `<li>${item}</li>`).join("");
    return;
  }

  elements.copySendText.textContent = "复制发送文案";
  elements.adminLead.textContent = "以后每次发测试链接前，先在这里生成一个新的专属密码。别人拿到你发出的密码后，才可以进入测试。";
  elements.adminHelper.textContent = "这个正式版会把密码保存到 Supabase。密码首次验证成功后，会自动绑定到对方当前浏览器；只有看到结果页后，密码才会正式作废。";
  elements.adminModeNote.textContent = "手机和电脑可以使用同一个 QQ 邮箱管理员账号登录，密码记录会保持同步。";
  elements.adminListNote.textContent = "别人即使看到了结果页，也只能看结果，不能直接进入测试。";
  elements.generatePassword.disabled = true;
  elements.copyLatestPassword.disabled = true;
  elements.copySendText.disabled = true;
  elements.authSignIn.disabled = false;
  elements.guideList.innerHTML = [
    "1. 使用已授权的 QQ 邮箱和管理员密码登录。",
    "2. 点击“生成一个新密码”，确认它出现在最新密码区域。",
    "3. 点击“复制发送文案”，直接发给这次的测试者。"
  ].map((item) => `<li>${item}</li>`).join("");
}

function renderRemoteSetupState() {
  renderStaticShell();
  elements.authState.textContent = "等待配置";
  elements.authEmail.textContent = "还没有连上 Supabase";
  elements.authHint.textContent = getSupabaseSetupMessage();
  elements.generatePassword.disabled = true;
  elements.copyLatestPassword.disabled = true;
  elements.copySendText.disabled = true;
  elements.authSignIn.disabled = !isSupabaseConfigured() || !isSupabaseSupportedEnvironment();
  renderLatest(null);
  renderStats([]);
  elements.passwordList.innerHTML = `
    <div class="password-empty">
      <p class="password-empty__title">还不能正式发码</p>
      <p class="helper-text">${getSupabaseSetupMessage()}</p>
    </div>
  `;
}

function renderAuthCard() {
  if (!passwordService.isRemoteMode()) {
    return;
  }

  if (state.isAdmin) {
    elements.authState.textContent = "管理员已就绪";
    elements.authEmail.textContent = state.currentUser?.email || "管理员账号";
    elements.authHint.textContent = "账号已验证。你可以在手机或电脑上生成并复制最新的一次性密码。";
    elements.loginForm.hidden = true;
    elements.authSignOut.style.display = "block";
    elements.generatePassword.disabled = false;
    elements.copyLatestPassword.disabled = false;
    elements.copySendText.disabled = false;
    return;
  }

  elements.authState.textContent = state.currentUser ? "无管理员权限" : "等待登录";
  elements.authEmail.textContent = state.currentUser?.email || "使用你的 QQ 邮箱登录";
  elements.authHint.textContent = state.currentUser
    ? "这个账号已经登录，但尚未被授权为管理员。请先完成一次管理员迁移设置。"
    : "手机和电脑都使用同一个账号。管理员密码只由你自己保管，不会写入网页。";
  elements.loginForm.hidden = false;
  elements.authSignOut.style.display = state.currentUser ? "block" : "none";
  elements.authSignIn.disabled = false;
  elements.generatePassword.disabled = true;
  elements.copyLatestPassword.disabled = true;
  elements.copySendText.disabled = true;
}

function renderLockedList() {
  elements.passwordList.innerHTML = `
    <div class="password-empty">
      <p class="password-empty__title">需要管理员权限</p>
      <p class="helper-text">请先使用已授权的 QQ 邮箱登录密码管理页。</p>
    </div>
  `;
}

async function handleAdminSignIn(event) {
  event.preventDefault();

  if (state.isSigningIn) {
    return;
  }

  state.isSigningIn = true;
  elements.authSignIn.disabled = true;

  try {
    const user = await signInAdminWithPassword(
      elements.adminEmailInput.value,
      elements.adminPasswordInput.value
    );
    const adminStatus = await getAdminStatus();
    applyAdminStatus(user, adminStatus);
    renderAuthCard();

    if (state.isAdmin) {
      elements.adminPasswordInput.value = "";
      await refreshEntries();
      showToast("管理员登录成功");
    } else {
      renderLockedList();
      showToast("该 QQ 邮箱尚未获得管理员权限");
    }
  } catch (error) {
    showToast(getFriendlyError(error, "登录失败，请检查 QQ 邮箱和管理员密码。"));
  } finally {
    state.isSigningIn = false;
    elements.authSignIn.disabled = false;
  }
}

async function handleAdminSignOut() {
  try {
    await signOutCurrentUser();
    applyAdminStatus(null, null);
    renderAuthCard();
    renderLatest(null);
    renderStats([]);
    renderLockedList();
    showToast("已退出管理员账号");
  } catch (error) {
    showToast(getFriendlyError(error, "退出失败，请稍后再试。"));
  }
}

async function handleGeneratePassword() {
  if (state.isGenerating) {
    return;
  }

  state.isGenerating = true;
  elements.generatePassword.disabled = true;

  try {
    const result = await passwordService.addGeneratedPassword();
    state.latestEntry = result;
    await refreshEntries(result.code);
    showToast(`已生成新密码：${result.code}`);
  } catch (error) {
    showToast(getFriendlyError(error, "生成密码失败，请稍后再试。"));
  } finally {
    state.isGenerating = false;

    if (!passwordService.isRemoteMode() || state.isAdmin) {
      elements.generatePassword.disabled = false;
    }
  }
}

async function handleCopyLatestPassword() {
  const latestEntry = state.latestEntry || state.entries[0] || null;

  if (!latestEntry) {
    showToast("请先生成一个新密码");
    return;
  }

  copyText(latestEntry.code, "最新密码已复制");
}

async function handleCopySendText() {
  const latestEntry = state.latestEntry || state.entries[0] || null;

  if (!latestEntry) {
    showToast("请先生成一个新密码");
    return;
  }

  const sendText = passwordService.isRemoteMode()
    ? [
        "这是这次测试的入口和专属密码：",
        `测试入口：${testEntryUrl}`,
        `测试密码：${latestEntry.code}`,
        "说明：首次验证成功后会绑定当前浏览器；中途退出可在同一浏览器继续；看到结果页后密码会自动作废。"
      ].join("\n")
    : [
        "这是本机静态演示版：",
        `测试入口：${testEntryUrl}`,
        `当前密码：${latestEntry.code}`,
        "说明：静态版密码只在当前浏览器里有效，不适合正式发给别人。"
      ].join("\n");

  copyText(sendText, passwordService.isRemoteMode() ? "发送文案已复制" : "操作说明已复制");
}

async function refreshEntries(preferredCode = "") {
  try {
    state.entries = await passwordService.getPasswordEntries();
    const normalizedPreferredCode = passwordService.normalizePassword(preferredCode);
    state.latestEntry = normalizedPreferredCode
      ? state.entries.find((entry) => entry.code === normalizedPreferredCode) || state.latestEntry
      : state.entries[0] || null;
    renderLatest(state.latestEntry || state.entries[0] || null);
    renderStats(state.entries);
    renderList(state.entries);
  } catch (error) {
    renderLatest(state.latestEntry || state.entries[0] || null);
    renderStats([]);
    elements.passwordList.innerHTML = `
      <div class="password-empty">
        <p class="password-empty__title">暂时无法读取密码库</p>
        <p class="helper-text">${getFriendlyError(error, "请确认管理员权限和 Supabase 配置已经完成。")}</p>
      </div>
    `;
  }
}

function renderLatest(entry) {
  if (!entry) {
    elements.latestPassword.textContent = "尚未生成";
    elements.latestMeta.textContent = passwordService.isRemoteMode()
      ? "登录管理员账号后，点击上方按钮生成新的正式测试密码。"
      : "点击上方按钮后，这里会显示刚生成的新密码。";
    return;
  }

  elements.latestPassword.textContent = entry.code;
  elements.latestMeta.textContent = `生成时间：${formatTime(entry.record.createdAt)} | 当前状态：${getStatusLabel(entry.record.status)}`;
}

function renderStats(entries) {
  const counts = entries.reduce((accumulator, entry) => {
    accumulator[entry.record.status] += 1;
    return accumulator;
  }, { unused: 0, active: 0, used: 0 });

  elements.countUnused.textContent = String(counts.unused);
  elements.countActive.textContent = String(counts.active);
  elements.countUsed.textContent = String(counts.used);
}

function renderList(entries) {
  if (!entries.length) {
    elements.passwordList.innerHTML = `
      <div class="password-empty">
        <p class="password-empty__title">当前还没有正式密码</p>
        <p class="helper-text">先点击“生成一个新密码”，再把测试入口和密码一起发出去。</p>
      </div>
    `;
    return;
  }

  elements.passwordList.innerHTML = entries.map((entry, index) => `
    <article class="password-row">
      <div class="password-row__main">
        <div class="password-row__top">
          <strong class="password-row__code">${entry.code}</strong>
          <span class="status-pill status-pill--${entry.record.status}">${getStatusLabel(entry.record.status)}</span>
        </div>
        <p class="password-row__meta">生成时间：${formatTime(entry.record.createdAt)}</p>
        <p class="password-row__meta">${getBindText(entry.record)}</p>
      </div>
      <div class="password-row__actions">
        <button class="action-button ${index === 0 ? "action-button--primary" : ""}" data-copy-code="${entry.code}" type="button">复制密码</button>
      </div>
    </article>
  `).join("");

  Array.from(elements.passwordList.querySelectorAll("[data-copy-code]")).forEach((button) => {
    button.addEventListener("click", () => {
      copyText(button.dataset.copyCode, "密码已复制");
    });
  });
}

function getStatusLabel(status) {
  if (status === "active") {
    return "进行中";
  }

  if (status === "used") {
    return "已作废";
  }

  return "未使用";
}

function getBindText(record) {
  if (record.status === "used" && record.usedAt) {
    return `结果页已到达：${formatTime(record.usedAt)}`;
  }

  if (record.status === "active" && record.authUid) {
    return "当前密码已经绑定到一台设备，可在同一浏览器继续作答。";
  }

  return "当前还没有绑定设备，可以发给新的测试者使用。";
}

function formatTime(value) {
  if (!value) {
    return "刚生成";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function copyText(text, successMessage) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMessage))
      .catch(() => fallbackCopy(text, successMessage));
    return;
  }

  fallbackCopy(text, successMessage);
}

function fallbackCopy(text, successMessage) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
    showToast(successMessage);
  } catch (error) {
    showToast("当前环境不支持自动复制，请手动复制。");
  }

  document.body.removeChild(textarea);
}

function getFriendlyError(error, fallbackMessage) {
  const rawMessage = error && typeof error.message === "string" ? error.message : "";

  if (rawMessage.includes("permission")) {
    return "当前身份没有权限执行这个操作，请先确认是否在正确的管理员浏览器里。";
  }

  if (rawMessage.includes("network") || rawMessage.includes("fetch")) {
    return "网络连接不稳定，请稍后再试。";
  }

  if (rawMessage.includes("管理员")) {
    return rawMessage;
  }

  return rawMessage || fallbackMessage;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");

  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
  }

  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 1800);
}
