const passwordService = window.CELEB_QUIZ_PASSWORDS;
const testEntryUrl = new URL("./index.html", window.location.href).toString();
const isStaticMode = !passwordService.isRemoteMode();

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
  toast: document.getElementById("toast")
};

let toastTimer = null;

bindEvents();
render();

function bindEvents() {
  elements.generatePassword.addEventListener("click", handleGeneratePassword);
  elements.copyLatestPassword.addEventListener("click", handleCopyLatestPassword);
  elements.copySendText.addEventListener("click", handleCopySendText);
  elements.copyTestLink.addEventListener("click", () => copyText(testEntryUrl, "测试入口链接已复制"));
  elements.openTestEntry.addEventListener("click", () => {
    window.open(testEntryUrl, "_blank", "noopener");
  });

  window.addEventListener("focus", render);
  window.addEventListener("storage", (event) => {
    if (event.key === passwordService.STORAGE_KEYS.passwordStore) {
      render();
    }
  });
}

async function handleGeneratePassword() {
  try {
    const result = await passwordService.addGeneratedPassword();
    await render();
    showToast(`已生成新密码：${result.code}`);
  } catch (error) {
    showToast("生成密码失败，请稍后再试");
  }
}

async function handleCopyLatestPassword() {
  const latestEntry = await getLatestEntry();

  if (!latestEntry) {
    showToast("请先生成一个新密码");
    return;
  }

  copyText(latestEntry.code, "最新密码已复制");
}

async function handleCopySendText() {
  const latestEntry = await getLatestEntry();

  if (!latestEntry) {
    showToast("请先生成一个新密码");
    return;
  }

  const sendText = isStaticMode
    ? [
        "这是免费静态版的本机测试说明：",
        `测试入口：${testEntryUrl}`,
        `当前密码：${latestEntry.code}`,
        "请先在当前这个浏览器里生成密码，再回到测试入口输入。",
        "注意：免费静态版的密码不能发给别的设备直接使用，只适合你自己演示或测试流程。"
      ].join("\n")
    : [
        "这是这次测试的入口和专属密码：",
        `测试入口：${testEntryUrl}`,
        `测试密码：${latestEntry.code}`,
        "说明：首次验证成功后会绑定当前设备；中途退出可在同一浏览器继续；看到结果页后密码会作废。"
      ].join("\n");

  copyText(sendText, isStaticMode ? "操作说明已复制" : "发送文案已复制");
}

async function getLatestEntry() {
  const entries = await passwordService.getPasswordEntries();
  return entries[0] || null;
}

async function render() {
  try {
    const entries = await passwordService.getPasswordEntries();
    const latestEntry = entries[0] || null;

    renderModeCopy();
    renderLatest(latestEntry);
    renderStats(entries);
    renderList(entries);
  } catch (error) {
    renderModeCopy();
    renderLatest(null);
    renderStats([]);
    elements.passwordList.innerHTML = `
      <div class="password-empty">
        <p class="password-empty__title">暂时无法读取密码库</p>
        <p class="helper-text">如果你在用正式服务模式，请确认服务器已经启动。</p>
      </div>
    `;
  }
}

function renderModeCopy() {
  if (isStaticMode) {
    elements.copySendText.textContent = "复制操作说明";
    elements.adminLead.textContent = "这里用于生成测试密码，并管理当前浏览器里的密码记录。免费静态版下，密码只保存在当前浏览器内，适合你自己演示和测试完整流程。";
    elements.adminHelper.textContent = "如果你只是想先拿到一个可分享链接，这一版已经足够；但它不支持真正的跨设备发码。";
    elements.adminModeNote.textContent = "当前是免费静态版：密码不会同步到别人的设备，只能在你生成它的这个浏览器里使用。";
    elements.adminListNote.textContent = "到达结果页后，该密码会在当前浏览器内作废。";
    return;
  }

  elements.copySendText.textContent = "复制发送文案";
  elements.adminLead.textContent = "以后每次发测试链接前，先在这里生成一个新的专属密码。这套正式版密码不会公开展示，只会进入服务端密码库。";
  elements.adminHelper.textContent = "建议发送方式：把你真正发布出去的测试链接，和这里生成的新密码一起发给对方。";
  elements.adminModeNote.textContent = "正式版不再预置公开演示密码。只有你在这里新生成的密码，才能进入当前测试。";
  elements.adminListNote.textContent = "到达结果页后，该密码会自动变成已作废。";
}

function renderLatest(entry) {
  if (!entry) {
    elements.latestPassword.textContent = "尚未生成";
    elements.latestMeta.textContent = "点击上方按钮后，这里会显示刚生成的新密码。";
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
        <p class="helper-text">先点击“生成一个新密码”，再把测试链接和密码一起发出去。</p>
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

  if (record.deviceId) {
    return "已绑定某一台设备，可在同一浏览器继续测试。";
  }

  return "尚未绑定设备，可以发给新的测试者使用。";
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
    showToast("当前环境不支持自动复制，请手动复制");
  }

  document.body.removeChild(textarea);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 1800);
}
