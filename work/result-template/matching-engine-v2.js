const AXIS_PAIRS = [
  { key: "EI", positive: "E", negative: "I" },
  { key: "NS", positive: "N", negative: "S" },
  { key: "TF", positive: "T", negative: "F" },
  { key: "JP", positive: "J", negative: "P" },
  { key: "OA", positive: "O", negative: "A" },
  { key: "HC", positive: "H", negative: "C" }
];

const MODULE_WEIGHTS = {
  initial: 0.78,
  relation: 1,
  pressure: 1.24,
  outline: 1.16
};

const AXIS_LANGUAGE = {
  E: "你会借助互动和反馈校准方向",
  I: "你会先回到自己的节奏里形成判断",
  N: "你更容易先看见可能性、方向与后续空间",
  S: "你更相信具体经验、可执行步骤和眼前事实",
  T: "你做决定时会优先检查逻辑、结构与代价",
  F: "你做决定时会把人的感受、关系和价值放进来",
  J: "你倾向于尽快建立秩序并把事情推进到位",
  P: "你倾向于保留弹性，在变化中继续修正",
  O: "你常常先观察、体会和复盘，再决定如何行动",
  A: "你常常在行动中确认判断，愿意先迈出一步",
  H: "你对关系温度和现场气氛有较快的感知",
  C: "你对边界、标准和分寸有较稳定的要求"
};

const AXIS_TERMS = {
  EI: {
    positive: ["外向", "表达", "连接", "感染", "带动", "组织", "公共", "亲和", "在场", "热烈"],
    negative: ["安静", "独处", "内心", "内在", "深潜", "私密", "含蓄", "自守", "向内", "疏离"]
  },
  NS: {
    positive: ["想象", "前瞻", "未来", "抽象", "概念", "理想", "愿景", "开创", "创造", "诗意", "叙事"],
    negative: ["务实", "实际", "实操", "落地", "脚下", "具体", "工具", "工程", "准确", "实践", "现实"]
  },
  TF: {
    positive: ["理性", "逻辑", "判断", "分析", "结构", "系统", "标准", "精准", "拆解", "推演"],
    negative: ["温柔", "温暖", "情感", "关怀", "悲悯", "体贴", "善意", "人情", "柔软", "照料"]
  },
  JP: {
    positive: ["秩序", "规划", "执行", "推进", "完成", "责任", "稳定", "长期", "纪律", "严谨", "建设", "坚守"],
    negative: ["自由", "灵活", "流动", "试错", "冒险", "适应", "弹性", "好玩", "探索", "轻盈"]
  },
  OA: {
    positive: ["观察", "体察", "洞察", "复盘", "深度", "耐心", "细致", "审慎", "感知", "发现"],
    negative: ["行动", "主动", "推动", "直接", "果断", "冲劲", "开路", "改造", "突破", "上手"]
  },
  HC: {
    positive: ["温暖", "热度", "亲和", "感染", "情感", "柔软", "关怀", "热烈", "温情", "真挚"],
    negative: ["克制", "冷静", "边界", "分寸", "标准", "原则", "秩序", "自持", "清醒", "冷感"]
  }
};

const ABILITY_COPY = {
  people: {
    label: "关系感知",
    high: "你能较快读到关系里的情绪、距离和没有直接说出口的需要。",
    mid: "你会兼顾人的感受与事情本身，再决定用什么方式靠近。",
    low: "你更习惯先确认事实和边界，关系信息需要多一点时间才会进入判断。"
  },
  judgment: {
    label: "判断定向",
    high: "面对复杂信息时，你通常能较快抓到主线，并形成自己的取舍标准。",
    mid: "你会在几种可能之间比较轻重，等依据足够后再定方向。",
    low: "你愿意保留更多可能，判断形成得较慢，但不容易草率下结论。"
  },
  execution: {
    label: "行动推进",
    high: "一旦确认值得做，你会自然进入推进状态，把想法变成可见进展。",
    mid: "你更擅长按自己的节奏持续推进，不追求声势，但重视真正完成。",
    low: "你需要先建立认同感和清晰感，准备充分后行动会更稳定。"
  },
  stability: {
    label: "压力稳定",
    high: "局面越复杂，你越容易收拢注意力，先处理真正关键的部分。",
    mid: "压力出现时你会有波动，但通常能在短暂缓冲后重新找回秩序。",
    low: "你对压力变化较敏感，恢复质量很依赖休息、边界和可控节奏。"
  },
  growth: {
    label: "长期生长",
    high: "你会自然考虑一件事能否积累、延伸，并形成更长久的价值。",
    mid: "你既会照顾眼前结果，也愿意为未来保留持续调整的空间。",
    low: "你更容易被当下任务吸引，长期方向需要被拆成更具体的阶段。"
  }
};

export function buildAssessmentResult({ data, answers, mode }) {
  const answerProfile = buildAnswerProfile(data, answers);
  const ranked = rankCandidates(data.results, answerProfile, mode);
  const winner = ranked[0];

  if (!winner) {
    throw new Error("没有找到符合当前匹配模式的人物候选");
  }

  const typeConfig = data.typesByMbti64[winner.result.mbti64_type] || {};
  const abilities = buildAbilities(answerProfile);
  const evidenceItems = buildEvidenceItems(answerProfile.records, winner.candidateProfile.axes);
  const topAbilities = [...abilities].sort((left, right) => right.rawValue - left.rawValue);
  const strongest = topAbilities[0];
  const second = topAbilities[1];
  const growth = topAbilities[topAbilities.length - 1];
  const similarity = calibrateSimilarity(winner.score);
  const keywords = [
    winner.result.keyword_1,
    winner.result.keyword_2,
    winner.result.keyword_3,
    winner.result.keyword_4
  ].filter(Boolean);

  return {
    version: 2,
    resultId: winner.result.result_id,
    mbti64Type: winner.result.mbti64_type,
    personName: winner.result.person_name,
    resultTitle: "你的名人原型",
    similarity,
    scoreCaption: buildScoreCaption(similarity),
    keywords,
    archetypeNote: buildArchetypeNote(typeConfig, strongest, second),
    shareBlurb: `这次匹配综合比较了 24 道选择中的关系方式、压力反应、行动节奏与长期取向。`,
    whyLike: winner.result.why_like,
    profileSummary: winner.result.profile_summary,
    currentPerformance: buildCurrentPerformance(answerProfile, strongest, second),
    currentState: buildCurrentState(answerProfile, growth),
    lifeAdvice: buildLifeAdvice(strongest, growth),
    evidenceItems,
    adviceItems: buildAdviceItems(strongest, second, growth),
    abilities,
    matchMeta: {
      engine: "continuous-profile-v2",
      candidatePoolSize: ranked.length,
      matchedScore: Number(winner.score.toFixed(4)),
      runnerUpGap: ranked[1] ? Number((winner.score - ranked[1].score).toFixed(4)) : null
    }
  };
}

export function rankAssessmentCandidates({ data, answers, mode }) {
  const answerProfile = buildAnswerProfile(data, answers);
  return rankCandidates(data.results, answerProfile, mode).map((entry, index) => ({
    rank: index + 1,
    resultId: entry.result.result_id,
    personName: entry.result.person_name,
    score: Number(entry.score.toFixed(6))
  }));
}

export function buildAssessmentProfile({ data, answers }) {
  return buildAnswerProfile(data, answers);
}

export function buildIdealAnswersForCandidate({ data, resultId }) {
  const result = data.results.find((entry) => entry.result_id === resultId);
  if (!result) throw new Error(`找不到人物结果：${resultId}`);

  const candidateProfile = buildCandidateProfile(result);
  const answers = {};

  data.questions.forEach((question) => {
    const moduleKey = question.module_key || "initial";
    const targetAxes = candidateProfile.modules[moduleKey] || candidateProfile.axes;
    const options = data.optionsByQuestion[question.question_id] || [];
    const rankedOptions = options.map((option) => ({
      option,
      score: compareProfiles(optionToAxes(option, moduleKey), targetAxes)
    })).sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.option.option_id.localeCompare(right.option.option_id);
    });

    if (rankedOptions[0]) answers[question.question_id] = rankedOptions[0].option.option_id;
  });

  return answers;
}

function buildAnswerProfile(data, answers) {
  const totals = emptyAxisTotals();
  const moduleTotals = {};
  const records = [];

  data.questions.forEach((question) => {
    const optionId = answers[question.question_id];
    const option = (data.optionsByQuestion[question.question_id] || [])
      .find((entry) => entry.option_id === optionId);

    if (!option) {
      return;
    }

    const moduleKey = question.module_key || option.module_key || "initial";
    const moduleWeight = MODULE_WEIGHTS[moduleKey] || 1;
    const optionTotals = emptyAxisTotals();

    Object.keys(totals).forEach((axis) => {
      const rawValue = Number(option[`raw_${axis}`] || option[`weighted_${axis}`] || 0);
      const weightedValue = rawValue * moduleWeight;
      totals[axis] += weightedValue;
      optionTotals[axis] = weightedValue;
    });

    if (!moduleTotals[moduleKey]) {
      moduleTotals[moduleKey] = emptyAxisTotals();
    }

    addAxisTotals(moduleTotals[moduleKey], optionTotals);
    records.push({ question, option, moduleKey, optionTotals });
  });

  const axes = totalsToAxes(totals);
  const modules = Object.fromEntries(
    Object.entries(moduleTotals).map(([key, value]) => [key, totalsToAxes(value)])
  );

  return {
    totals,
    axes,
    modules,
    behaviors: axesToBehaviors(axes),
    records
  };
}

function optionToAxes(option, moduleKey) {
  const totals = emptyAxisTotals();
  const moduleWeight = MODULE_WEIGHTS[moduleKey] || 1;
  Object.keys(totals).forEach((axis) => {
    totals[axis] = Number(option[`raw_${axis}`] || option[`weighted_${axis}`] || 0) * moduleWeight;
  });
  return totalsToAxes(totals);
}

function rankCandidates(results, answerProfile, mode) {
  const candidates = results
    .filter((result) => isCandidateAllowed(result, mode))
    .map((result) => {
      const candidateProfile = buildCandidateProfile(result);
      return {
        result,
        candidateProfile,
        score: scoreCandidate(answerProfile, candidateProfile)
      };
    });

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.result.result_id.localeCompare(right.result.result_id);
  });
}

function isCandidateAllowed(result, mode) {
  if (mode === "male") {
    return result.slot_key === "male";
  }

  if (mode === "female") {
    return result.slot_key === "female";
  }

  return true;
}

function buildCandidateProfile(result) {
  const explicitAxes = {
    EI: Number(result.profile_ei),
    NS: Number(result.profile_ns),
    TF: Number(result.profile_tf),
    JP: Number(result.profile_jp),
    OA: Number(result.profile_oa),
    HC: Number(result.profile_hc)
  };
  const hasExplicitProfile = Object.values(explicitAxes).every(Number.isFinite);
  const axes = hasExplicitProfile ? explicitAxes : typeToAxes(result.mbti64_type);
  const profileText = [
    result.keyword_1,
    result.keyword_2,
    result.keyword_3,
    result.keyword_4,
    result.why_like,
    result.profile_summary
  ].filter(Boolean).join("|");

  if (!hasExplicitProfile) {
    Object.entries(AXIS_TERMS).forEach(([axisKey, terms]) => {
      const positiveHits = countTermHits(profileText, terms.positive);
      const negativeHits = countTermHits(profileText, terms.negative);
      const adjustment = clamp((positiveHits - negativeHits) * 0.035, -0.2, 0.2);
      axes[axisKey] = clamp(axes[axisKey] + adjustment, -1, 1);
    });
  }

  return {
    axes,
    behaviors: axesToBehaviors(axes),
    modules: {
      relation: parseProfileJson(result.profile_relation_json, axes),
      pressure: parseProfileJson(result.profile_pressure_json, axes),
      outline: parseProfileJson(result.profile_outline_json, axes)
    },
    profileBasis: result.profile_basis || "类型方向与人物结果文案"
  };
}

function scoreCandidate(answerProfile, candidateProfile) {
  const overallFit = compareProfiles(answerProfile.axes, candidateProfile.axes);
  const behaviorFit = compareProfiles(answerProfile.behaviors, candidateProfile.behaviors);
  const pressureFit = compareProfiles(answerProfile.modules.pressure || answerProfile.axes, candidateProfile.modules.pressure || candidateProfile.axes);
  const relationFit = compareProfiles(answerProfile.modules.relation || answerProfile.axes, candidateProfile.modules.relation || candidateProfile.axes);
  const outlineFit = compareProfiles(answerProfile.modules.outline || answerProfile.axes, candidateProfile.modules.outline || candidateProfile.axes);

  return (
    overallFit * 0.42
    + behaviorFit * 0.24
    + pressureFit * 0.16
    + relationFit * 0.1
    + outlineFit * 0.08
  );
}

function parseProfileJson(value, fallback) {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    const keys = Object.keys(fallback);
    return keys.every((key) => Number.isFinite(Number(parsed[key])))
      ? Object.fromEntries(keys.map((key) => [key, Number(parsed[key])] ))
      : fallback;
  } catch (error) {
    return fallback;
  }
}

function compareProfiles(left, right) {
  const keys = Object.keys(left).filter((key) => Number.isFinite(right[key]));

  if (!keys.length) {
    return 0.5;
  }

  const distance = keys.reduce((sum, key) => sum + Math.abs(left[key] - right[key]), 0) / keys.length;
  const scale = keys.some((key) => AXIS_PAIRS.some((pair) => pair.key === key)) ? 2 : 1;
  return clamp(1 - distance / scale, 0, 1);
}

function buildAbilities(profile) {
  const pressure = profile.modules.pressure || profile.axes;
  const rawValues = {
    people: clamp(profile.behaviors.people * 0.72 + axisToUnit(profile.modules.relation?.HC ?? profile.axes.HC) * 0.28, 0, 1),
    judgment: clamp(profile.behaviors.judgment * 0.78 + axisToUnit(profile.modules.outline?.TF ?? profile.axes.TF) * 0.22, 0, 1),
    execution: clamp(profile.behaviors.execution * 0.72 + (1 - axisToUnit(profile.modules.outline?.OA ?? profile.axes.OA)) * 0.28, 0, 1),
    stability: clamp(profile.behaviors.stability * 0.62 + axisToUnit(-pressure.HC) * 0.22 + axisToUnit(pressure.JP) * 0.16, 0, 1),
    growth: clamp(profile.behaviors.growth * 0.72 + axisToUnit(profile.modules.outline?.NS ?? profile.axes.NS) * 0.28, 0, 1)
  };

  return Object.entries(rawValues).map(([key, rawValue]) => {
    const copy = ABILITY_COPY[key];
    const value = 70 + Math.round(rawValue * 25);
    const description = rawValue >= 0.67 ? copy.high : rawValue >= 0.43 ? copy.mid : copy.low;
    return { key, label: copy.label, value, rawValue, description };
  });
}

function buildEvidenceItems(records, candidateAxes) {
  const preferredModules = ["relation", "pressure", "outline", "initial"];
  const ranked = records.map((record) => {
    const optionAxes = totalsToAxes(record.optionTotals);
    return { ...record, fit: compareProfiles(optionAxes, candidateAxes) };
  }).sort((left, right) => right.fit - left.fit);

  const selected = [];

  preferredModules.forEach((moduleKey) => {
    const record = ranked.find((entry) => entry.moduleKey === moduleKey && !selected.includes(entry));
    if (record && selected.length < 3) {
      selected.push(record);
    }
  });

  ranked.forEach((record) => {
    if (selected.length < 3 && !selected.includes(record)) {
      selected.push(record);
    }
  });

  return selected.map((record) => ({
    module: record.question.module_name,
    question: record.question.question_text,
    answer: record.option.option_text,
    interpretation: interpretOption(record.optionTotals)
  }));
}

function interpretOption(totals) {
  const dominant = Object.entries(totals)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([axis]) => AXIS_LANGUAGE[axis]);

  if (!dominant.length) {
    return "这个选择体现了你会根据具体情境保留判断空间。";
  }

  return `${dominant.join("，同时")}。`;
}

function buildArchetypeNote(typeConfig, strongest, second) {
  const skeleton = trimSentence(typeConfig.shared_skeleton || "有自己的做事节奏，也愿意为重要的事持续投入");
  return `你最鲜明的底色落在“${strongest.label}”和“${second.label}”上：${skeleton}。`;
}

function buildCurrentPerformance(profile, strongest, second) {
  const relationAxis = profile.modules.relation || profile.axes;
  const relationText = relationAxis.HC >= 0
    ? "在人际互动里，你会先留意气氛与对方的感受，再调整表达力度"
    : "在人际互动里，你会先确认边界、事实和双方各自需要承担的部分";
  const actionText = profile.axes.OA >= 0
    ? "遇到重要事情时，你倾向于先看清局面，再选择最合适的切入点"
    : "遇到重要事情时，你倾向于先做出一个动作，再从反馈里修正方向";

  return `落到日常里，你最容易被看见的是${strongest.description}${relationText}；${actionText}。这两种倾向与“${second.label}”结合后，会让你的做事方式既有个人节奏，也有相对稳定的辨识度。`;
}

function buildCurrentState(profile, growth) {
  const pressure = profile.modules.pressure || profile.axes;
  const pressureText = pressure.JP >= 0
    ? "压力升高时，你会本能地收紧计划、责任和完成标准"
    : "压力升高时，你会先保留回旋空间，避免过早把自己锁进单一路径";
  const recoveryText = pressure.HC >= 0
    ? "恢复状态更依赖被理解、关系温度与情绪出口"
    : "恢复状态更依赖清晰边界、独立空间与重新建立秩序";

  return `从这次选择看，${pressureText}；${recoveryText}。目前较值得留意的是“${growth.label}”：${growth.description}这不是缺点，而是提醒你把精力分配得更有余地。`;
}

function buildLifeAdvice(strongest, growth) {
  return `继续使用“${strongest.label}”作为你的主力，但不要让它承担所有问题。给“${growth.label}”安排一个具体、可重复的小练习，比要求自己一次性改变更有效。`;
}

function buildAdviceItems(strongest, second, growth) {
  return [
    {
      title: "发挥优势",
      text: `把“${strongest.label}”用在真正重要、能产生长期价值的事情上，不必在每个场合都证明自己。`
    },
    {
      title: "保持平衡",
      text: `当“${strongest.label}”用得过满时，主动借用“${second.label}”检查节奏，避免优势变成持续消耗。`
    },
    {
      title: "试试这样做",
      text: `为“${growth.label}”设一个一周内能完成的小动作，完成后只记录效果，不急着评价自己。`
    }
  ];
}

function buildScoreCaption(similarity) {
  if (similarity >= 90) {
    return "高度贴近：多组选择指向同一人物底色";
  }

  if (similarity >= 78) {
    return "明显贴近：主要行为倾向具有一致性";
  }

  if (similarity >= 65) {
    return "部分贴近：核心方向相似，表达方式有所不同";
  }

  return "原型参考：你与这位人物共享部分做事底色";
}

function calibrateSimilarity(score) {
  const normalized = clamp((score - 0.74) / 0.15, 0, 1);
  return clamp(50 + Math.round(normalized * 49), 50, 99);
}

function typeToAxes(typeValue) {
  const [type16 = "", axisOA = "O", axisHC = "C"] = String(typeValue || "").split("-");
  return {
    EI: type16.includes("E") ? 0.72 : -0.72,
    NS: type16.includes("N") ? 0.72 : -0.72,
    TF: type16.includes("T") ? 0.72 : -0.72,
    JP: type16.includes("J") ? 0.72 : -0.72,
    OA: axisOA === "O" ? 0.72 : -0.72,
    HC: axisHC === "H" ? 0.72 : -0.72
  };
}

function totalsToAxes(totals) {
  return Object.fromEntries(AXIS_PAIRS.map((pair) => {
    const positive = Number(totals[pair.positive] || 0);
    const negative = Number(totals[pair.negative] || 0);
    const total = positive + negative;
    const value = total > 0 ? (positive - negative) / total : 0;
    return [pair.key, value];
  }));
}

function axesToBehaviors(axes) {
  const E = axisToUnit(axes.EI);
  const I = 1 - E;
  const N = axisToUnit(axes.NS);
  const S = 1 - N;
  const T = axisToUnit(axes.TF);
  const F = 1 - T;
  const J = axisToUnit(axes.JP);
  const O = axisToUnit(axes.OA);
  const A = 1 - O;
  const H = axisToUnit(axes.HC);
  const C = 1 - H;

  return {
    people: clamp(F * 0.44 + H * 0.34 + O * 0.14 + I * 0.08, 0, 1),
    judgment: clamp(T * 0.38 + C * 0.28 + J * 0.24 + O * 0.1, 0, 1),
    execution: clamp(A * 0.38 + J * 0.3 + E * 0.2 + T * 0.12, 0, 1),
    stability: clamp(C * 0.3 + S * 0.24 + J * 0.24 + I * 0.12 + T * 0.1, 0, 1),
    growth: clamp(N * 0.34 + O * 0.24 + J * 0.18 + A * 0.14 + T * 0.1, 0, 1)
  };
}

function emptyAxisTotals() {
  return { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0, O: 0, A: 0, H: 0, C: 0 };
}

function addAxisTotals(target, source) {
  Object.keys(target).forEach((axis) => {
    target[axis] += Number(source[axis] || 0);
  });
}

function countTermHits(text, terms) {
  return terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
}

function axisToUnit(value) {
  return (clamp(Number(value) || 0, -1, 1) + 1) / 2;
}

function trimSentence(value) {
  return String(value || "").replace(/[。！？!?]+$/g, "");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
