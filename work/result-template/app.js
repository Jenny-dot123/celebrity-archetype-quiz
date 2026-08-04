const passwordService = window.CELEB_QUIZ_PASSWORDS;
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
  abilityLegend: document.getElementById("ability-legend"),
  radarGrid: document.getElementById("radar-grid"),
  radarAxis: document.getElementById("radar-axis"),
  radarShape: document.getElementById("radar-shape"),
  radarPoints: document.getElementById("radar-points"),
  shareCopy: document.getElementById("share-copy"),
  sharePoster: document.getElementById("share-poster"),
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
    resultsById
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
  elements.sharePoster.addEventListener("click", () => showToast("这里可以继续接分享图生成接口"));
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

  elements.coverStart.textContent = "开始测试";
  elements.coverHelper.textContent = "结果页可以传播，但如果别人想自己测试，仍然必须输入新的有效密码。";
}

function renderPassword() {
  if (state.screen !== "password") {
    return;
  }

  state.passwordStore = initPasswordStore();

  if (!passwordService.isRemoteMode() && !Object.keys(state.passwordStore).length) {
    elements.passwordStatus.textContent = "当前还没有可用密码。请先在密码管理页生成一个新的测试密码。";
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

  elements.quizModule.textContent = question.module_name;
  elements.quizTitle.textContent = question.progress_label;
  elements.quizProgressText.textContent = question.progress_label;
  elements.questionText.textContent = question.question_text;
  elements.quizPrev.disabled = getCurrentQuestionIndex() === 0;
  elements.quizNext.disabled = !selectedOptionId;
    elements.quizNext.textContent = getCurrentQuestionIndex() === state.data.questions.length - 1 ? "提交并看结果" : "下一题";
    elements.quizHint.textContent = selectedOptionId
      ? "已记录当前选择，如果你想改，也可以返回上一题重新选。"
      : "按第一直觉选最像你的那个就好，这里没有标准答案。";

  elements.optionList.innerHTML = options.map((option) => `
    <button class="option-card ${selectedOptionId === option.option_id ? "is-selected" : ""}" data-option-id="${option.option_id}" type="button">
      <span class="option-card__key">${option.option_key}</span>
      <span class="option-card__text">${option.option_text}</span>
    </button>
  `).join("");

  Array.from(elements.optionList.querySelectorAll(".option-card")).forEach((button) => {
    button.addEventListener("click", () => {
      saveAnswer(question.question_id, button.dataset.optionId);
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
}

function renderKeywords(keywords) {
  elements.keywordList.innerHTML = keywords
    .map((keyword) => `<span class="keyword">${keyword}</span>`)
    .join("");
}

function renderAbilityLegend(abilities) {
  elements.abilityLegend.innerHTML = abilities.map((ability, index) => `
    <article class="ability-tile ability-tile--${ability.tone}">
      <div class="ability-tile__top">
        <span class="ability-tile__index">0${index + 1}</span>
        <span class="ability-tile__value">${ability.value}%</span>
      </div>
      <h3>${ability.label}</h3>
      <p>${ability.description}</p>
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
      <text class="radar-axis-label" x="${axis.labelX}" y="${axis.labelY}">${axis.ability.label}</text>
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
}

function handleQuizNext() {
  const question = state.data.questions[getCurrentQuestionIndex()];
  const selectedOptionId = state.session?.answers?.[question.question_id];

  if (!selectedOptionId) {
    showToast("请先选择一个选项");
    return;
  }

  if (getCurrentQuestionIndex() === state.data.questions.length - 1) {
    finalizeResult();
    setScreen("result");
    return;
  }

  state.session.currentQuestionIndex += 1;
  persistSession();
  render();
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

function saveAnswer(questionId, optionId) {
  if (!state.session) {
    return;
  }

  state.session.answers[questionId] = optionId;
  state.session.updatedAt = new Date().toISOString();
  persistSession();
  render();
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
  if (!state.session?.resultSnapshot) {
    finalizeResult();
  }

  return state.session.resultSnapshot;
}

function buildResultSnapshot() {
  const scores = computeAxisScores(state.session.answers);
  const mbti64Type = buildMbti64Type(scores);
  const typeConfig = state.data.typesByMbti64[mbti64Type];
  const resultId = pickResultId(typeConfig, state.session.mode, state.session.answers);
  const resultConfig = state.data.resultsById[resultId];
  const abilities = buildAbilities(scores);
  const keywords = [
    resultConfig.keyword_1,
    resultConfig.keyword_2,
    resultConfig.keyword_3,
    resultConfig.keyword_4
  ].filter(Boolean);
  const similarity = computeSimilarity(scores);
  const topAbility = [...abilities].sort((a, b) => b.value - a.value)[0];
  const lowestAbility = [...abilities].sort((a, b) => a.value - b.value)[0];
  const sharedSkeleton = trimSentence(typeConfig.shared_skeleton);

  return {
    resultId,
    mbti64Type,
    personName: resultConfig.person_name,
    resultTitle: resultConfig.result_title,
    similarity,
    scoreCaption: similarity >= 96 ? "极高命中区间" : similarity >= 91 ? "高命中区间" : "稳定命中区间",
    keywords,
    whyLike: resultConfig.why_like,
    profileSummary: `${resultConfig.profile_summary} 放到你身上，更像一种“${sharedSkeleton}”的任务气质。`,
    archetypeNote: `你给人的感觉，是那种${sharedSkeleton}的人。尤其在“${topAbility.label}”这件事上，很容易让人觉得你和 ${resultConfig.person_name} 有同一种底色。`,
    shareBlurb: `你的关键词会落在 ${keywords.slice(0, 3).join("、")} 这一条线上，看起来不是表面相似，而是做事底色很像。`,
    currentPerformance: `最近你更容易在“${topAbility.label}”上被看见。${topAbility.shortLine} 所以无论是处理关系、推进事情，还是面对临场变化，你都会自然带出一种 ${keywords.slice(0, 2).join("、")} 的感觉。`,
    currentState: deriveCurrentState(typeConfig, scores),
    lifeAdvice: `发挥优势的方式，不是一直把自己绷在最会做的那个位置上，而是把“${topAbility.label}”真正用到重要的事情上。试试这样做：继续保留你在“${topAbility.label}”上的强项，同时给“${lowestAbility.label}”留一点缓冲空间，别急着一次做到最满，反而更容易把整个人的状态调顺。`,
    abilities
  };
}

function computeAxisScores(answerMap) {
  const totals = {
    E: 0, I: 0, N: 0, S: 0, T: 0, F: 0,
    J: 0, P: 0, O: 0, A: 0, H: 0, C: 0
  };

  Object.entries(answerMap).forEach(([questionId, optionId]) => {
    const option = (state.data.optionsByQuestion[questionId] || []).find((entry) => entry.option_id === optionId);

    if (!option) {
      return;
    }

    Object.keys(totals).forEach((axis) => {
      totals[axis] += Number(option[`weighted_${axis}`] || 0);
    });
  });

  return totals;
}

function buildMbti64Type(scores) {
  const tiePreference = {
    EI: "I",
    NS: "N",
    TF: "F",
    JP: "J",
    OA: "O",
    HC: "C"
  };

  const pick = (left, right, pairKey) => {
    if (scores[left] > scores[right]) {
      return left;
    }

    if (scores[left] < scores[right]) {
      return right;
    }

    return tiePreference[pairKey];
  };

  const type16 = [
    pick("E", "I", "EI"),
    pick("N", "S", "NS"),
    pick("T", "F", "TF"),
    pick("J", "P", "JP")
  ].join("");

  return `${type16}-${pick("O", "A", "OA")}-${pick("H", "C", "HC")}`;
}

function pickResultId(typeConfig, mode, answers) {
  if (mode === "male") {
    return typeConfig.male_result_id;
  }

  if (mode === "female") {
    return typeConfig.female_result_id;
  }

  const pool = (typeConfig.random_pool_result_ids || "")
    .split("|")
    .filter(Boolean);
  const hashSeed = `${typeConfig.type_id}|${state.session.passwordCode}|${Object.values(answers).join("|")}`;
  const index = Math.abs(hashString(hashSeed)) % pool.length;
  return pool[index];
}

function buildAbilities(scores) {
  const ratios = {
    feeling: ratio(scores.F, scores.T),
    logic: ratio(scores.T, scores.F),
    warm: ratio(scores.H, scores.C),
    cool: ratio(scores.C, scores.H),
    intro: ratio(scores.I, scores.E),
    extro: ratio(scores.E, scores.I),
    explore: ratio(scores.N, scores.S),
    grounded: ratio(scores.S, scores.N),
    order: ratio(scores.J, scores.P),
    observe: ratio(scores.O, scores.A),
    action: ratio(scores.A, scores.O)
  };

  const values = {
    people: scaleAbility(0.48 * ratios.feeling + 0.32 * ratios.warm + 0.2 * ratios.intro),
    judgment: scaleAbility(0.42 * ratios.cool + 0.33 * ratios.logic + 0.25 * ratios.order),
    execution: scaleAbility(0.38 * ratios.action + 0.34 * ratios.order + 0.28 * ratios.extro),
    stability: scaleAbility(0.38 * ratios.cool + 0.24 * ratios.grounded + 0.2 * ratios.intro + 0.18 * ratios.order),
    growth: scaleAbility(0.34 * ratios.explore + 0.25 * ratios.observe + 0.23 * ratios.order + 0.18 * ratios.action)
  };

  return [
    createAbility("人际感应", values.people, "warm", {
      high: "你很会先读空气、读关系，再决定自己该怎么靠近和推进。",
      mid: "你会一边感受场上的人，一边调整自己的表达方式。",
      low: "你不是不会感受别人，而是更习惯先把重点和边界想清楚。"
    }),
    createAbility("判断主心", values.judgment, "deep", {
      high: "你做判断时很少只看表面，心里通常有一条自己的主线。",
      mid: "你会先衡量轻重和结构，再决定事情该怎样落下去。",
      low: "你并非没有判断，而是更容易在多种可能之间先保留弹性。"
    }),
    createAbility("推进执行", values.execution, "warm", {
      high: "只要认定值得做，你就会很自然地开始带节奏、抓推进。",
      mid: "你推进事情时更像稳稳往前，不一定张扬，但会持续动起来。",
      low: "你不太吃爆发式推进，更适合按自己的节奏把事情一点点做成。"
    }),
    createAbility("压力定力", values.stability, "deep", {
      high: "一旦环境变乱，你反而会更快切到稳定和清醒的处理方式。",
      mid: "面对压力时，你通常会先把自己收住，再慢慢把局面理顺。",
      low: "压力来的时候你会先感受到波动，但只要给你一点缓冲，还是能慢慢稳回来。"
    }),
    createAbility("长线生长", values.growth, "warm", {
      high: "你很在意一件事后面能不能继续长、继续积累，而不是只看眼前。",
      mid: "你会自然去想这件事能否留下来、沉下去、变成长期价值。",
      low: "你不是没有远线感，而是更容易先被当下变化牵动，再慢慢回到长期。"
    })
  ];
}

function createAbility(label, value, tone, lines) {
  let description = lines.low;

  if (value >= 90) {
    description = lines.high;
  } else if (value >= 82) {
    description = lines.mid;
  }

  const extraLine = value >= 90
    ? "这会让你在关键时刻显得很有辨识度。"
    : value >= 82
      ? "所以别人常会觉得你做事有自己的稳定节奏。"
      : "也因此你更适合在顺手的场域里慢慢发挥。";

  return {
    label,
    value,
    tone,
    shortLine: description,
    description: `${description}${extraLine}`
  };
}

function deriveCurrentState(typeConfig, scores) {
  const oaText = typeConfig.axis_oa === "O"
    ? "你现在更像在先观察、先体会，再决定什么时候真正出手。"
    : "你现在更像在边想边动，很多判断会在行动里慢慢长出来。";

  const hcText = typeConfig.axis_hc === "H"
    ? "你对关系温度和场面气氛会比较敏感，环境一变，你很快就能感觉到。"
    : "你对边界、分寸和结构会更敏感，所以现在会本能地想把很多事情先理顺。";

  const eiText = scores.I >= scores.E
    ? "这段时间你也更需要自己的节奏感，不太适合一直被外界拉着跑。"
    : "这段时间你更容易靠互动、反馈和行动感来校准自己。";

  return `${oaText}${hcText}${eiText}`;
}

function computeSimilarity(scores) {
  const margins = [
    axisMargin(scores.E, scores.I),
    axisMargin(scores.N, scores.S),
    axisMargin(scores.T, scores.F),
    axisMargin(scores.J, scores.P),
    axisMargin(scores.O, scores.A),
    axisMargin(scores.H, scores.C)
  ];

  const average = margins.reduce((sum, item) => sum + item, 0) / margins.length;
  return clamp(82 + Math.round(average * 16), 82, 98);
}

function axisMargin(left, right) {
  const total = left + right;
  return total <= 0 ? 0.5 : Math.abs(left - right) / total;
}

function ratio(left, right) {
  const total = left + right;
  return total <= 0 ? 0.5 : left / total;
}

function scaleAbility(value) {
  return 70 + Math.round(clamp(value, 0, 1) * 25);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}

function trimSentence(value) {
  return String(value || "").replace(/[。！？!?]+$/g, "");
}

function sanitizePassword(value) {
  return passwordService.normalizePassword(value);
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
