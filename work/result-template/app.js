import * as passwordService from "./password-store.js?v=20260811-release-d";
import { buildAssessmentResult } from "./matching-engine-v2.js?v=20260811-release-d";
const STORAGE_KEYS = passwordService.STORAGE_KEYS;

const SHARE_QUERY_KEY = "share";

const state = {
  data: prepareData(window.CELEB_QUIZ_DATA),
  deviceId: initDeviceId(),
  session: loadJson(STORAGE_KEYS.session, null),
  passwordStore: initPasswordStore(),
  sharedSnapshot: loadSharedSnapshot(),
  sharedView: false,
  screen: "cover",
  toastTimer: null
};

state.sharedView = Boolean(state.sharedSnapshot);
reconcileSessionWithPasswordStore();

const elements = {
  screens: Array.from(document.querySelectorAll(".screen")),
  progressStage: document.getElementById("progress-stage"),
  progressCount: document.getElementById("progress-count"),
  progressFill: document.getElementById("progress-fill"),
  coverStart: document.getElementById("cover-start"),
  coverHelper: document.getElementById("cover-helper"),
  passwordCopy: document.getElementById("password-copy"),
  passwordInput: document.getElementById("password-input"),
  passwordSubmit: document.getElementById("password-submit"),
  passwordBack: document.getElementById("password-back"),
  passwordStatus: document.getElementById("password-status"),
  modeCards: Array.from(document.querySelectorAll(".mode-card")),
  modeBack: document.getElementById("mode-back"),
  quizModule: document.getElementById("quiz-module"),
  quizTitle: document.getElementById("quiz-title"),
  quizProgressText: document.getElementById("quiz-progress-text"),
  questionText: document.getElementById("question-text"),
  optionList: document.getElementById("option-list"),
  quizPrev: document.getElementById("quiz-prev"),
  quizNext: document.getElementById("quiz-next"),
  quizHint: document.getElementById("quiz-hint"),
  title: document.getElementById("result-title"),
  note: document.getElementById("archetype-note"),
  similarity: document.getElementById("similarity"),
  scoreCaption: document.getElementById("score-caption"),
  personName: document.getElementById("person-name"),
  shareBlurb: document.getElementById("share-blurb"),
  keywordList: document.getElementById("keyword-list"),
  whyLike: document.getElementById("why-like"),
  profileSummary: document.getElementById("profile-summary"),
  currentPerformance: document.getElementById("current-performance"),
  currentState: document.getElementById("current-state"),
  lifeAdvice: document.getElementById("life-advice"),
  abilitySummary: document.getElementById("ability-summary"),
  abilityLegend: document.getElementById("ability-legend"),
  evidenceList: document.getElementById("evidence-list"),
  evidenceSection: document.getElementById("evidence-title")?.closest(".report-section"),
  adviceList: document.getElementById("advice-list"),
  radarGrid: document.getElementById("radar-grid"),
  radarAxis: document.getElementById("radar-axis"),
  radarShape: document.getElementById("radar-shape"),
  radarPoints: document.getElementById("radar-points"),
  shareCopy: document.getElementById("share-copy"),
  shareRestart: document.getElementById("share-restart"),
  toast: document.getElementById("toast")
};

bindEvents();
syncScreenFromState();
render();

function prepareData(rawData) {
  const normalizeRow = (row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [String(key).replace(/^\uFEFF/, ""), value])
  );

  const questions = [...rawData.questions].map(normalizeRow).sort((a, b) => Number(a.question_no) - Number(b.question_no));
  const options = [...rawData.options].map(normalizeRow).sort((a, b) => {
    if (a.question_no === b.question_no) {
      return a.option_key.localeCompare(b.option_key);
    }

    return Number(a.question_no) - Number(b.question_no);
  });

  const optionsByQuestion = options.reduce((accumulator, option) => {
    if (!accumulator[option.question_id]) {
      accumulator[option.question_id] = [];
    }

    accumulator[option.question_id].push(option);
    return accumulator;
  }, {});

  const typesByMbti64 = rawData.types.map(normalizeRow).reduce((accumulator, type) => {
    accumulator[type.mbti64_type] = type;
    return accumulator;
  }, {});

  const resultsById = rawData.results.map(normalizeRow).reduce((accumulator, result) => {
    accumulator[result.result_id] = result;
    return accumulator;
  }, {});

  return {
    questions,
    optionsByQuestion,
    typesByMbti64,
    resultsById,
    results: Object.values(resultsById)
  };
}

function initDeviceId() {
  let deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);

  if (!deviceId) {
    deviceId = `device_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
  }

  return deviceId;
}

function initPasswordStore() {
  return passwordService.initPasswordStore();
}

function loadJson(key, fallbackValue) {
  return passwordService.loadJson(key, fallbackValue);
}

function saveJson(key, value) {
  passwordService.saveJson(key, value);
}

function reconcileSessionWithPasswordStore() {
  if (passwordService.isRemoteMode()) {
    return;
  }

  if (!state.session || state.session.completed || !state.session.passwordCode) {
    return;
  }

  if (!state.passwordStore[state.session.passwordCode]) {
    state.session = null;
    localStorage.removeItem(STORAGE_KEYS.session);
  }
}

function bindEvents() {
  elements.coverStart.addEventListener("click", handleCoverStart);
  elements.passwordSubmit.addEventListener("click", handlePasswordSubmit);
  elements.passwordBack.addEventListener("click", () => setScreen("cover"));
  elements.modeBack.addEventListener("click", () => setScreen("password"));
  elements.quizPrev.addEventListener("click", handleQuizPrev);
  elements.quizNext.addEventListener("click", handleQuizNext);
  elements.passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handlePasswordSubmit();
    }
  });

  elements.modeCards.forEach((card) => {
    card.addEventListener("click", () => selectMode(card.dataset.mode));
  });

  elements.shareCopy.addEventListener("click", handleShareCopy);
  elements.shareRestart.addEventListener("click", handleRestartFromResult);
}

function syncScreenFromState() {
  if (state.sharedView && state.sharedSnapshot) {
    state.screen = "result";
    return;
  }

  if (!state.session) {
    state.screen = "cover";
    return;
  }

  if (state.session.completed && state.session.resultSnapshot) {
    state.screen = "result";
    return;
  }

  if (state.session.mode) {
    state.screen = "quiz";
    return;
  }

  if (state.session.passwordCode) {
    state.screen = "mode";
    return;
  }

  state.screen = "cover";
}

function render() {
  elements.screens.forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === state.screen);
  });

  renderProgress();
  renderCover();
  renderPassword();
  renderMode();

  if (state.screen === "quiz") {
    renderQuiz();
  }

  if (state.screen === "result") {
    renderResult();
  }
}

function renderProgress() {
  let stage = "准备开始";
  let percent = 0;

  if (state.sharedView && state.screen === "result") {
    stage = "分享结果";
    percent = 100;
    } else if (state.screen === "password") {
      stage = "入口验证";
      percent = 8;
    } else if (state.screen === "mode") {
      stage = "选择方向";
      percent = 16;
  } else if (state.screen === "quiz") {
    const currentIndex = getCurrentQuestionIndex();
    const currentQuestion = state.data.questions[currentIndex];
    stage = currentQuestion ? currentQuestion.module_name : "测试进行中";
    percent = 16 + Math.round(((currentIndex + 1) / state.data.questions.length) * 74);
  } else if (state.screen === "result") {
    stage = "结果完成";
    percent = 100;
  }

  elements.progressStage.textContent = stage;
  elements.progressCount.textContent = `${percent}%`;
  elements.progressFill.style.width = `${percent}%`;
}

function renderCover() {
  if (state.sharedView) {
    elements.coverStart.textContent = "输入密码开始测试";
    elements.coverHelper.textContent = "当前这条链接是分享结果页，不包含测试权限。";
    return;
  }

  const session = state.session;

    if (session && !session.completed) {
      elements.coverStart.textContent = "继续上次测试";
      elements.coverHelper.textContent = "当前浏览器检测到未完成进度，你可以直接继续上次的答题。";
      return;
    }

    if (session && session.completed && session.resultSnapshot) {
      elements.coverStart.textContent = "输入新密码开始测试";
      elements.coverHelper.textContent = `上一次命中结果是「${session.resultSnapshot.personName}」。如果想再测一次，仍然需要新的有效密码。`;
      return;
  }

  if (!passwordService.isRemoteMode()) {
    elements.coverStart.textContent = "开始测试";
    elements.coverHelper.textContent = "这是免费静态版：结果页可以分享，但测试密码只在当前浏览器有效，更适合你自己演示或试跑流程。";
    return;
  }

  elements.coverStart.textContent = "开始测试";
  elements.coverHelper.textContent = "结果页可以传播，但如果别人想自己测试，仍然必须输入新的有效密码。";
}

function renderPassword() {
  if (state.screen !== "password") {
    return;
  }

  if (!passwordService.isRemoteMode()) {
    elements.passwordCopy.textContent = "免费版说明：请先在同一浏览器的密码管理页生成密码，再回到这里输入。这个密码不能发给别的设备直接使用。";
  } else {
    elements.passwordCopy.textContent = "这次测试采用一次性密码进入。首次验证成功后，会默认绑定当前设备；中途退出也可以在同一浏览器继续。只有看到结果页后，这个密码才会正式作废。";
  }

  state.passwordStore = initPasswordStore();

  if (!passwordService.isRemoteMode() && !Object.keys(state.passwordStore).length) {
    elements.passwordStatus.textContent = "当前浏览器还没有可用密码。请先打开 password-admin.html 生成一个新密码，再回来输入。";
    return;
  }

    if (state.session && !state.session.completed && state.session.passwordCode) {
      elements.passwordStatus.textContent = `当前浏览器已有进行中的密码记录：${state.session.passwordCode}。输入同一密码，就能继续上次的测试。`;
      return;
    }

    elements.passwordStatus.textContent = "请输入当前仍有效的测试密码，验证成功后就可以进入下一步。";
}

function renderMode() {
  elements.modeCards.forEach((card) => {
    const isSelected = Boolean(state.session && state.session.mode === card.dataset.mode);
    card.classList.toggle("is-selected", isSelected);
  });
}

function renderQuiz() {
  const question = state.data.questions[getCurrentQuestionIndex()];

  if (!question) {
    return;
  }

  const selectedOptionId = state.session?.answers?.[question.question_id] || null;
  const options = state.data.optionsByQuestion[question.question_id] || [];
  const isLastQuestion = getCurrentQuestionIndex() === state.data.questions.length - 1;

  elements.quizModule.textContent = question.module_name;
  elements.quizTitle.textContent = question.progress_label;
  elements.quizProgressText.textContent = question.progress_label;
  elements.questionText.textContent = question.question_text;
  elements.quizPrev.hidden = getCurrentQuestionIndex() === 0;
  elements.quizNext.hidden = !isLastQuestion || !selectedOptionId;
  elements.quizNext.disabled = !selectedOptionId;
  elements.quizNext.textContent = "查看结果";
  elements.quizHint.textContent = selectedOptionId
    ? (isLastQuestion
      ? "已记录最后一题，确认无误后点击“查看结果”。"
      : "已记录，正在进入下一题。")
    : "按第一直觉选最像你的那个就好，这里没有标准答案。";

  elements.optionList.innerHTML = options.map((option) => `
    <button class="option-card ${selectedOptionId === option.option_id ? "is-selected" : ""}" data-option-id="${option.option_id}" type="button">
      <span class="option-card__key">${option.option_key}</span>
      <span class="option-card__text">${option.option_text}</span>
    </button>
  `).join("");

  Array.from(elements.optionList.querySelectorAll(".option-card")).forEach((button) => {
    button.addEventListener("click", () => {
      handleOptionSelection(question.question_id, button.dataset.optionId);
    });
  });
}

function renderResult() {
  const snapshot = state.sharedView && state.sharedSnapshot
    ? state.sharedSnapshot
    : ensureResultSnapshot();

  elements.title.textContent = snapshot.resultTitle;
  elements.note.textContent = snapshot.archetypeNote;
  elements.similarity.textContent = `${snapshot.similarity}%`;
  elements.scoreCaption.textContent = snapshot.scoreCaption;
  elements.personName.textContent = snapshot.personName;
  elements.shareBlurb.textContent = snapshot.shareBlurb;
  elements.whyLike.textContent = snapshot.whyLike;
  elements.profileSummary.textContent = snapshot.profileSummary;
  elements.currentPerformance.textContent = snapshot.currentPerformance;
  elements.currentState.textContent = snapshot.currentState;
  elements.lifeAdvice.textContent = snapshot.lifeAdvice;
  elements.shareRestart.textContent = state.sharedView ? "前往密码入口" : "回到密码入口";

  renderKeywords(snapshot.keywords);
  renderRadar(snapshot.abilities);
  renderAbilityLegend(snapshot.abilities);
  renderAbilitySummary(snapshot.abilities);
  renderEvidence(snapshot.evidenceItems || []);
  renderAdvice(snapshot.adviceItems || [], snapshot.abilities);
}

function renderKeywords(keywords) {
  elements.keywordList.innerHTML = keywords
    .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
    .join("");
}

function renderAbilityLegend(abilities) {
  elements.abilityLegend.innerHTML = abilities.map((ability, index) => `
    <article class="ability-row">
      <div class="ability-row__head">
        <span class="ability-row__index">0${index + 1}</span>
        <h3>${escapeHtml(ability.label)}</h3>
        <span class="ability-row__value">${Number(ability.value)}%</span>
      </div>
      <p>${escapeHtml(ability.description)}</p>
    </article>
  `).join("");
}

function renderAbilitySummary(abilities) {
  const ranked = [...abilities].sort((left, right) => Number(right.value) - Number(left.value));
  const strongest = ranked[0];
  const growth = ranked[ranked.length - 1];

  if (!strongest || !growth) {
    elements.abilitySummary.textContent = "五个维度共同构成你这次的行为结构。";
    return;
  }

  elements.abilitySummary.textContent = `本次最突出的维度是“${strongest.label}”，相对需要补充的是“${growth.label}”。分数用于比较本次答案中的相对倾向，不代表能力高低。`;
}

function renderEvidence(items) {
  if (!items.length) {
    elements.evidenceSection.hidden = true;
    elements.evidenceList.innerHTML = "";
    return;
  }

  elements.evidenceSection.hidden = false;

  elements.evidenceList.innerHTML = items.map((item, index) => `
    <article class="evidence-item">
      <p class="evidence-item__module">${String(index + 1).padStart(2, "0")} · ${escapeHtml(item.module)}</p>
      <h3>${escapeHtml(item.answer)}</h3>
      <p>${escapeHtml(item.interpretation)}</p>
      <details>
        <summary>查看对应题目</summary>
        <p>${escapeHtml(item.question)}</p>
      </details>
    </article>
  `).join("");
}

function renderAdvice(items, abilities) {
  const fallbackAbilities = [...abilities].sort((left, right) => Number(right.value) - Number(left.value));
  const fallback = [
    { title: "发挥优势", text: `继续使用“${fallbackAbilities[0]?.label || "优势维度"}”，但把它留给真正重要的事情。` },
    { title: "保持平衡", text: "优势持续用得过满也会带来消耗，给自己保留恢复和调整的空间。" },
    { title: "试试这样做", text: `为“${fallbackAbilities.at(-1)?.label || "成长维度"}”设置一个一周内能完成的小练习。` }
  ];
  const adviceItems = items.length ? items : fallback;

  elements.adviceList.innerHTML = adviceItems.map((item, index) => `
    <article class="advice-item">
      <span class="advice-item__number">${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.text)}</p>
    </article>
  `).join("");
}

function renderRadar(abilities) {
  const geometry = getRadarGeometry(abilities);

  elements.radarGrid.innerHTML = geometry.rings
    .map((points, ringIndex) => `<polygon class="radar-ring" points="${points}" data-ring="${ringIndex + 1}"></polygon>`)
    .join("");

  elements.radarAxis.innerHTML = geometry.axes.map((axis) => `
    <g>
      <line class="radar-axis-line" x1="${geometry.centerX}" y1="${geometry.centerY}" x2="${axis.x}" y2="${axis.y}"></line>
      <text class="radar-axis-label" x="${axis.labelX}" y="${axis.labelY}">${escapeHtml(axis.ability.label)}</text>
    </g>
  `).join("");

  elements.radarShape.setAttribute("points", geometry.shapePoints.map((point) => `${point.x},${point.y}`).join(" "));
  elements.radarPoints.innerHTML = geometry.shapePoints
    .map((point) => `<circle class="radar-point" cx="${point.x}" cy="${point.y}" r="5"></circle>`)
    .join("");
}

function getRadarGeometry(abilities) {
  const centerX = 210;
  const centerY = 170;
  const radius = 122;
  const steps = 5;
  const angleStep = (Math.PI * 2) / abilities.length;
  const baseAngle = -Math.PI / 2;

  const rings = Array.from({ length: steps }, (_, ringIndex) => {
    const ringRadius = (radius / steps) * (ringIndex + 1);
    return abilities.map((_, pointIndex) => {
      const angle = baseAngle + pointIndex * angleStep;
      const x = centerX + Math.cos(angle) * ringRadius;
      const y = centerY + Math.sin(angle) * ringRadius;
      return `${x},${y}`;
    }).join(" ");
  });

  const axes = abilities.map((ability, pointIndex) => {
    const angle = baseAngle + pointIndex * angleStep;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const labelX = centerX + Math.cos(angle) * (radius + 34);
    const labelY = centerY + Math.sin(angle) * (radius + 34);
    return { ability, x, y, labelX, labelY };
  });

  const shapePoints = abilities.map((ability, pointIndex) => {
    const angle = baseAngle + pointIndex * angleStep;
    const ratio = ability.value / 100;
    const x = centerX + Math.cos(angle) * radius * ratio;
    const y = centerY + Math.sin(angle) * radius * ratio;
    return { x, y };
  });

  return { centerX, centerY, rings, axes, shapePoints };
}

function handleCoverStart() {
  if (state.sharedView) {
    clearShareUrl();
    state.sharedView = false;
    state.sharedSnapshot = null;
    setScreen("password");
    return;
  }

  if (state.session && !state.session.completed) {
    if (state.session.mode) {
      setScreen("quiz");
    } else {
      setScreen("mode");
    }

    return;
  }

  setScreen("password");
}

async function handlePasswordSubmit() {
  state.passwordStore = initPasswordStore();
  const passwordCode = sanitizePassword(elements.passwordInput.value);

  if (!passwordCode) {
    elements.passwordStatus.textContent = "请先输入测试密码。";
    showToast("请先输入测试密码");
    return;
  }

  const verification = await passwordService.verifyPassword(passwordCode, state.deviceId);

  if (!verification.ok) {
    elements.passwordStatus.textContent = verification.message;
    showToast(verification.code === "used" ? "这个密码已作废" : verification.message);
    return;
  }

  if (!state.session || state.session.passwordCode !== passwordCode || state.session.completed) {
    state.session = {
      passwordCode,
      mode: null,
      answers: {},
      currentQuestionIndex: 0,
      completed: false,
      resultSnapshot: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  state.passwordStore = initPasswordStore();
  persistSession();
  elements.passwordStatus.textContent = verification.message;
  setScreen("mode");
}

function handleQuizPrev() {
  if (!state.session) {
    return;
  }

  state.session.currentQuestionIndex = Math.max(0, getCurrentQuestionIndex() - 1);
  persistSession();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function handleQuizNext() {
  const question = state.data.questions[getCurrentQuestionIndex()];

  if (getCurrentQuestionIndex() !== state.data.questions.length - 1) {
    return;
  }

  const selectedOptionId = state.session?.answers?.[question.question_id];

  if (!selectedOptionId) {
    showToast("请先选择一个选项");
    return;
  }

  finalizeResult();
  setScreen("result");
}

function handleShareCopy() {
  const snapshot = state.sharedView && state.sharedSnapshot
    ? state.sharedSnapshot
    : ensureResultSnapshot();
  const shareUrl = createShareUrl(snapshot);
  const text = [
    snapshot.resultTitle,
    `相似指数：${snapshot.similarity}%`,
    `关键词：${snapshot.keywords.join(" / ")}`,
    `为什么像TA：${snapshot.whyLike}`,
    `当前状态：${snapshot.currentState}`,
    `人生建议：${snapshot.lifeAdvice}`,
    `结果链接：${shareUrl}`,
    "想自己测，仍然需要新的有效密码。"
  ].join("\n");

  navigator.clipboard.writeText(text)
    .then(() => showToast("分享文案和结果链接已复制"))
    .catch(() => showToast("当前环境不支持复制，可继续接真实分享接口"));
}

function handleRestartFromResult() {
  if (state.sharedView) {
    state.sharedView = false;
    state.sharedSnapshot = null;
    clearShareUrl();
    setScreen("password");
    return;
  }

  state.session = null;
  localStorage.removeItem(STORAGE_KEYS.session);
  setScreen("password");
}

function selectMode(mode) {
  if (!state.session) {
    showToast("请先验证密码");
    setScreen("password");
    return;
  }

  state.session.mode = mode;
  state.session.updatedAt = new Date().toISOString();
  persistSession();
  setScreen("quiz");
}

function handleOptionSelection(questionId, optionId) {
  if (!state.session) {
    return;
  }

  state.session.answers[questionId] = optionId;
  state.session.updatedAt = new Date().toISOString();
  persistSession();

  const advancesToNextQuestion = getCurrentQuestionIndex() < state.data.questions.length - 1;

  if (advancesToNextQuestion) {
    state.session.currentQuestionIndex += 1;
    state.session.updatedAt = new Date().toISOString();
    persistSession();
  }

  render();

  if (advancesToNextQuestion) {
    window.scrollTo({ top: 0, behavior: "instant" });
  } else {
    elements.quizNext.scrollIntoView({ behavior: "instant", block: "nearest" });
  }
}

function finalizeResult() {
  if (!state.session) {
    return;
  }

  state.session.resultSnapshot = buildResultSnapshot();
  state.session.completed = true;
  state.session.updatedAt = new Date().toISOString();

  passwordService.markPasswordUsed(state.session.passwordCode).then(() => {
    state.passwordStore = initPasswordStore();
  }).catch(() => {});

  persistSession();
}

function ensureResultSnapshot() {
  if (!state.session) {
    return null;
  }

  const snapshot = state.session.resultSnapshot;
  const hasCompleteAnswers = state.data.questions.every((question) => (
    Boolean(state.session.answers?.[question.question_id])
  ));
  const needsEvidenceUpgrade = !Array.isArray(snapshot?.evidenceItems)
    || snapshot.evidenceItems.length < 3;

  if ((!snapshot || needsEvidenceUpgrade) && hasCompleteAnswers && state.session.mode) {
    state.session.resultSnapshot = buildResultSnapshot();
    state.session.updatedAt = new Date().toISOString();
    persistSession();
  } else if (!snapshot) {
    finalizeResult();
  }

  return state.session.resultSnapshot;
}

function buildResultSnapshot() {
  return buildAssessmentResult({
    data: state.data,
    answers: state.session.answers,
    mode: state.session.mode
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function sanitizePassword(value) {
  return passwordService.normalizePassword(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getCurrentQuestionIndex() {
  return clamp(Number(state.session?.currentQuestionIndex || 0), 0, state.data.questions.length - 1);
}

function persistSession() {
  if (state.session) {
    saveJson(STORAGE_KEYS.session, state.session);
  }
}

function setScreen(screenName) {
  state.screen = screenName;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
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

function loadSharedSnapshot() {
  try {
    const shareValue = new URLSearchParams(window.location.search).get(SHARE_QUERY_KEY);

    if (!shareValue) {
      return null;
    }

    const json = decodeBase64Utf8(shareValue);
    const parsed = JSON.parse(json);
    return parsed && parsed.resultTitle && Array.isArray(parsed.abilities) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function createShareUrl(snapshot) {
  const payload = encodeBase64Utf8(JSON.stringify(snapshot));
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARE_QUERY_KEY, payload);
  return url.toString();
}

function clearShareUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_QUERY_KEY);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

function encodeBase64Utf8(value) {
  return window.btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64Utf8(value) {
  return decodeURIComponent(escape(window.atob(value)));
}
