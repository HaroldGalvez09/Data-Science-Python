const STORAGE_KEY = "toefl-reading-2026-state";
const HISTORY_KEY = "toefl-reading-2026-history";

const questionBank = {
  module1: {
    id: "module1",
    label: "Module 1",
    kind: "base",
    durationMinutes: 12,
    tasks: [
      createCompleteWordsTask(),
      createDailyShortTask(),
      createDailyLongTask(),
      createAcademicTaskA(),
    ],
  },
  module2Easy: {
    id: "module2Easy",
    label: "Module 2 Easy",
    kind: "easy",
    durationMinutes: 10,
    tasks: [
      createCompleteWordsTaskEasy(),
      createDailyShortTaskEasy(),
      createDailyLongTaskEasy(),
      createDailyShortTaskTransit(),
    ],
  },
  module2Hard: {
    id: "module2Hard",
    label: "Module 2 Hard",
    kind: "hard",
    durationMinutes: 10,
    tasks: [
      createCompleteWordsTaskHard(),
      createAcademicTaskB(),
      createDailyShortTaskHard(),
    ],
  },
};

const defaultConfig = {
  routingThreshold: 0.6,
  moduleDurations: {
    module1: 12,
    module2Easy: 10,
    module2Hard: 10,
  },
  moduleComposition: {
    module1: questionBank.module1.tasks.map((task) => task.id),
    module2Easy: questionBank.module2Easy.tasks.map((task) => task.id),
    module2Hard: questionBank.module2Hard.tasks.map((task) => task.id),
  },
};

let state = loadState() || createInitialState();
let timerHandle = null;

normalizeState();
render();
startTimerLoop();

function createInitialState() {
  const config = JSON.parse(JSON.stringify(defaultConfig));
  const exam = buildExam(config);
  return {
    config,
    exam,
    session: {
      startedAt: null,
      completedAt: null,
      currentModuleId: "module1",
      currentQuestionId: exam.modules[0].questions[0].id,
      module2Selection: null,
      status: "idle",
      history: loadHistory(),
      lastSavedAt: null,
    },
  };
}

function normalizeState() {
  if (!state.session.history) state.session.history = loadHistory();
  if (!state.config) state.config = JSON.parse(JSON.stringify(defaultConfig));
  if (!state.exam) state.exam = buildExam(state.config);
  state.exam.modules.forEach((module) => {
    module.durationMinutes = state.config.moduleDurations[module.id] ?? module.durationMinutes;
  });
}

function buildExam(config) {
  const makeModule = (moduleKey) => {
    const bankModule = questionBank[moduleKey];
    const allowedTaskIds = config.moduleComposition[moduleKey] || bankModule.tasks.map((task) => task.id);
    const tasks = bankModule.tasks
      .filter((task) => allowedTaskIds.includes(task.id))
      .map((task) => structuredClone(task));
    const questions = tasks.flatMap((task) =>
      task.questions.map((question, index) => ({
        ...question,
        moduleId: bankModule.id,
        taskId: task.id,
        taskLabel: task.title,
        orderLabel: `${task.title} · ${index + 1}`,
        answer: question.answer ?? (question.type === "multi" ? null : ""),
        flagged: false,
        visited: false,
        answeredAt: null,
        firstSeenAt: null,
        timeSpentMs: 0,
        lastViewedAt: null,
      }))
    );
    return {
      id: bankModule.id,
      label: bankModule.label,
      kind: bankModule.kind,
      durationMinutes: config.moduleDurations[moduleKey] ?? bankModule.durationMinutes,
      startedAt: null,
      submittedAt: null,
      locked: moduleKey !== "module1",
      questions,
      tasks,
      score: null,
    };
  };

  const module1 = makeModule("module1");
  const module2Easy = makeModule("module2Easy");
  const module2Hard = makeModule("module2Hard");
  return { modules: [module1, module2Easy, module2Hard] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveState() {
  state.session.lastSavedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveHistory(entry) {
  const history = [entry, ...loadHistory()].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  state.session.history = history;
}

function startExam() {
  const module1 = getModule("module1");
  const now = Date.now();
  state.session.status = "in_progress";
  state.session.startedAt = new Date(now).toISOString();
  module1.startedAt = state.session.startedAt;
  state.session.currentModuleId = "module1";
  state.session.currentQuestionId = module1.questions[0]?.id || null;
  touchQuestion(module1.questions[0]);
  saveState();
  render();
}

function resetExam() {
  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState();
  startTimerLoop();
  render();
}

function applyAdminConfig(formData) {
  state.config.routingThreshold = clamp(Number(formData.get("routingThreshold")) / 100, 0.1, 0.95);
  state.config.moduleDurations.module1 = clampInt(Number(formData.get("durationModule1")), 1, 60);
  state.config.moduleDurations.module2Easy = clampInt(Number(formData.get("durationModule2Easy")), 1, 60);
  state.config.moduleDurations.module2Hard = clampInt(Number(formData.get("durationModule2Hard")), 1, 60);
  state.exam = buildExam(state.config);
  state.session.status = "idle";
  state.session.startedAt = null;
  state.session.completedAt = null;
  state.session.currentModuleId = "module1";
  state.session.currentQuestionId = state.exam.modules[0].questions[0].id;
  state.session.module2Selection = null;
  saveState();
  render();
}

function startTimerLoop() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    if (state.session.status !== "in_progress") return;
    const module = getCurrentModule();
    const question = getCurrentQuestion();
    if (question?.lastViewedAt) {
      const now = Date.now();
      question.timeSpentMs += now - question.lastViewedAt;
      question.lastViewedAt = now;
    }
    const remaining = getModuleTimeRemainingMs(module);
    if (remaining <= 0) {
      autoSubmitModule(module.id);
    }
    saveState();
    render(false);
  }, 1000);
}

function getModuleTimeRemainingMs(module) {
  if (!module?.startedAt) return module.durationMinutes * 60 * 1000;
  const elapsed = Date.now() - new Date(module.startedAt).getTime();
  return module.durationMinutes * 60 * 1000 - elapsed;
}

function getModule(moduleId) {
  return state.exam.modules.find((module) => module.id === moduleId);
}

function getCurrentModule() {
  return getModule(state.session.currentModuleId);
}

function getCurrentQuestion() {
  return getCurrentModule()?.questions.find((question) => question.id === state.session.currentQuestionId);
}

function touchQuestion(question) {
  if (!question) return;
  const now = Date.now();
  question.visited = true;
  if (!question.firstSeenAt) question.firstSeenAt = now;
  question.lastViewedAt = now;
}

function setCurrentQuestion(questionId) {
  const module = getCurrentModule();
  const current = getCurrentQuestion();
  if (current?.lastViewedAt) {
    current.timeSpentMs += Date.now() - current.lastViewedAt;
    current.lastViewedAt = null;
  }
  const next = module.questions.find((question) => question.id === questionId);
  state.session.currentQuestionId = questionId;
  touchQuestion(next);
  saveState();
  render();
}

function updateAnswer(questionId, value) {
  const question = state.exam.modules.flatMap((module) => module.questions).find((item) => item.id === questionId);
  if (!question) return;
  question.answer = value;
  question.answeredAt = Date.now();
  autosaveQuestion(question);
  render(false);
}

function autosaveQuestion(question) {
  question.visited = true;
  saveState();
}

function toggleFlag(questionId) {
  const question = getCurrentModule().questions.find((item) => item.id === questionId);
  question.flagged = !question.flagged;
  saveState();
  render();
}

function submitCurrentModule(manual = false) {
  const module = getCurrentModule();
  if (!module) return;
  gradeModule(module);
  module.submittedAt = new Date().toISOString();
  if (module.id === "module1") {
    const accuracy = module.score.correct / module.score.total;
    const nextModuleId = accuracy >= state.config.routingThreshold ? "module2Hard" : "module2Easy";
    state.session.module2Selection = nextModuleId;
    const nextModule = getModule(nextModuleId);
    nextModule.locked = false;
    nextModule.startedAt = new Date().toISOString();
    state.session.currentModuleId = nextModuleId;
    state.session.currentQuestionId = nextModule.questions[0].id;
    touchQuestion(nextModule.questions[0]);
  } else {
    finalizeExam();
  }
  if (manual) saveState();
  render();
}

function autoSubmitModule(moduleId) {
  if (state.session.status !== "in_progress") return;
  if (state.session.currentModuleId !== moduleId) return;
  submitCurrentModule(false);
  saveState();
}

function finalizeExam() {
  state.session.status = "completed";
  state.session.completedAt = new Date().toISOString();
  const report = buildReport();
  saveHistory({
    completedAt: state.session.completedAt,
    rawScore: report.rawScore,
    total: report.total,
    module2Selection: state.session.module2Selection,
    accuracy: report.overallAccuracy,
  });
  saveState();
}

function gradeModule(module) {
  const scoredQuestions = module.questions.filter((question) => question.scored !== false);
  const correct = scoredQuestions.filter((question) => isQuestionCorrect(question)).length;
  module.score = {
    correct,
    total: scoredQuestions.length,
    accuracy: scoredQuestions.length ? correct / scoredQuestions.length : 0,
  };
}

function isQuestionCorrect(question) {
  if (question.type === "text") {
    return normalize(question.answer) === normalize(question.correctAnswer);
  }
  if (question.type === "textGroup") {
    return question.correctAnswer.every((part, index) => normalize(question.answer[index]) === normalize(part));
  }
  if (question.type === "multi") {
    return question.answer === question.correctAnswer;
  }
  return false;
}

function buildReport() {
  const allQuestions = state.exam.modules
    .filter((module) => module.id === "module1" || module.id === state.session.module2Selection)
    .flatMap((module) => module.questions);
  const scored = allQuestions.filter((question) => question.scored !== false);
  const correct = scored.filter(isQuestionCorrect).length;
  return {
    rawScore: correct,
    total: scored.length,
    overallAccuracy: scored.length ? correct / scored.length : 0,
    byTaskType: aggregateAccuracy(scored, "taskType"),
    bySkillType: aggregateAccuracy(scored, "skillType"),
    errorReview: scored.filter((question) => !isQuestionCorrect(question)),
    questions: allQuestions,
  };
}

function aggregateAccuracy(questions, field) {
  return Object.entries(
    questions.reduce((acc, question) => {
      const key = question[field] || "General";
      acc[key] ||= { label: key, correct: 0, total: 0 };
      acc[key].total += 1;
      if (isQuestionCorrect(question)) acc[key].correct += 1;
      return acc;
    }, {})
  ).map(([, entry]) => ({
    ...entry,
    accuracy: entry.total ? entry.correct / entry.total : 0,
  }));
}

function navigateQuestion(direction) {
  const module = getCurrentModule();
  const currentIndex = module.questions.findIndex((question) => question.id === state.session.currentQuestionId);
  const next = module.questions[currentIndex + direction];
  if (next) setCurrentQuestion(next.id);
}

function formatTime(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function render(scrollTop = true) {
  const app = document.getElementById("app");
  const module = getCurrentModule();
  const question = getCurrentQuestion();
  const report = state.session.status === "completed" ? buildReport() : null;
  app.innerHTML = `
    <div class="app-shell">
      <div class="header">
        <div class="brand">
          <h1>TOEFL Reading 2026 · Practice Lab</h1>
          <p>Práctica iterativa con routing adaptativo, autosave por pregunta y resultados inmediatos.</p>
        </div>
        <div class="status-bar">
          <div class="pill">Estado: <strong>${state.session.status}</strong></div>
          <div class="pill">Módulo activo: <strong>${module?.label || "—"}</strong></div>
          <div class="pill">Autosave: <strong>${state.session.lastSavedAt ? new Date(state.session.lastSavedAt).toLocaleTimeString("es-ES") : "pendiente"}</strong></div>
        </div>
      </div>
      <div class="layout">
        <aside class="sidebar">${renderSidebar(module)}</aside>
        <main class="main">
          ${renderIntroPanel()}
          ${state.session.status === "completed" ? renderResults(report) : renderQuestionPanel(module, question)}
          ${renderAdminPanel()}
          ${renderHistoryPanel()}
        </main>
      </div>
    </div>
  `;
  bindEvents();
  if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderIntroPanel() {
  const chosen = state.session.module2Selection ? getModule(state.session.module2Selection) : null;
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2 style="margin:0;">Blueprint del examen</h2>
          <div class="meta">Module 1 = 20 ítems. Module 2 se adapta con umbral configurable (${Math.round(state.config.routingThreshold * 100)}%).</div>
        </div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button class="primary" data-action="start" ${state.session.status !== "idle" ? "disabled" : ""}>Comenzar intento</button>
          <button class="ghost" data-action="reset">Reiniciar sesión</button>
        </div>
      </div>
      <div class="stats-list">
        <div class="stat"><span>Duración Module 1</span><strong>${state.config.moduleDurations.module1} min</strong></div>
        <div class="stat"><span>Duración Module 2 Easy</span><strong>${state.config.moduleDurations.module2Easy} min</strong></div>
        <div class="stat"><span>Duración Module 2 Hard</span><strong>${state.config.moduleDurations.module2Hard} min</strong></div>
        <div class="stat"><span>Routing actual</span><strong>${chosen ? chosen.label : "Pendiente"}</strong></div>
      </div>
      <p class="meta" style="margin-top:1rem;">Reglas activas: navegación libre dentro del módulo, bloqueo de regreso a Module 1 después de iniciar Module 2, autosave por respuesta y auto-submit cuando el tiempo llega a cero.</p>
    </section>
  `;
}

function renderSidebar(module) {
  const modules = state.exam.modules.filter((item) => item.id === "module1" || item.id === state.session.module2Selection || item.kind === "base");
  return `
    <h3 style="margin-top:0;">Módulos</h3>
    ${modules
      .map((item) => {
        const active = item.id === module?.id;
        const isLocked = item.id !== "module1" && item.id !== state.session.module2Selection;
        const timeRemaining = item.startedAt ? formatTime(getModuleTimeRemainingMs(item)) : `${String(item.durationMinutes).padStart(2, "0")}:00`;
        return `
          <div class="module-card ${active ? "active" : ""} ${isLocked ? "locked" : ""}">
            <div>
              <strong>${item.label}</strong>
              <div class="meta">${item.questions.length} preguntas · ${timeRemaining}</div>
            </div>
            <span class="badge">${item.score ? `${item.score.correct}/${item.score.total}` : item.kind}</span>
          </div>`;
      })
      .join("")}
    <div class="legend" style="margin-top:1rem;">
      <span><i style="background:#dff5ec"></i> Respondida</span>
      <span><i style="background:#e6edff"></i> Actual</span>
      <span><i style="background:#ffb547"></i> Marcada</span>
    </div>
    ${module ? `<h3 style="margin-top:1.2rem;">Preguntas</h3>
      <div class="question-nav">
        ${module.questions
          .map((question, index) => `
            <button
              data-question-id="${question.id}"
              class="${question.id === state.session.currentQuestionId ? "current" : ""} ${hasAnswer(question) ? "answered" : ""} ${question.flagged ? "flagged" : ""}"
            >${index + 1}</button>`)
          .join("")}
      </div>` : ""}
  `;
}

function renderQuestionPanel(module, question) {
  if (state.session.status === "idle") {
    return `<section class="panel"><h2 style="margin-top:0;">Listo para practicar</h2><p>Configura el examen desde el panel admin y presiona <strong>Comenzar intento</strong>.</p></section>`;
  }
  if (!module || !question) {
    return `<section class="panel"><p>No hay preguntas disponibles.</p></section>`;
  }
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2 style="margin:0;">${question.orderLabel}</h2>
          <div class="meta">Task type: ${question.taskType} · Skill: ${question.skillType} · Remaining: ${formatTime(getModuleTimeRemainingMs(module))}</div>
        </div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button class="secondary" data-action="flag">${question.flagged ? "Desmarcar" : "Marcar"}</button>
          <button class="danger" data-action="submit-module">Enviar ${module.label}</button>
        </div>
      </div>
      ${question.type === "textGroup" ? renderTextGroupQuestion(question) : renderPassageQuestion(question)}
      <div class="footer-actions">
        <div class="meta">No podrás volver a Module 1 una vez que comience Module 2.</div>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button class="ghost" data-action="prev" ${module.questions[0].id === question.id ? "disabled" : ""}>Anterior</button>
          <button class="primary" data-action="next" ${module.questions[module.questions.length - 1].id === question.id ? "disabled" : ""}>Siguiente</button>
        </div>
      </div>
    </section>
  `;
}

function renderTextGroupQuestion(question) {
  return `
    <div>
      <div class="prompt">${question.prompt}</div>
      <div class="passage" style="margin-bottom:1rem;">${question.passage}</div>
      ${question.blanks
        .map((blank, index) => `
          <div class="blank-row">
            <strong>${index + 1}</strong>
            <div>
              <div>${blank.clue}</div>
              <div class="meta">Escribe la segunda mitad que completa la palabra original.</div>
            </div>
            <div>
              <div class="split-word">${blank.prefix}____</div>
              <input data-blank-index="${index}" data-question-id="${question.id}" value="${escapeHtml(question.answer[index] || "")}" placeholder="Completa" />
            </div>
          </div>`)
        .join("")}
    </div>
  `;
}

function renderPassageQuestion(question) {
  return `
    <div class="reading-grid">
      <div class="passage">${question.passage}</div>
      <div>
        <div class="prompt">${question.prompt}</div>
        <div class="options">
          ${question.options
            .map((option, index) => `
              <label class="option">
                <input type="radio" name="${question.id}" value="${index}" data-question-id="${question.id}" ${String(question.answer) === String(index) ? "checked" : ""} />
                <span><strong>${String.fromCharCode(65 + index)}.</strong> ${option}</span>
              </label>`)
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderResults(report) {
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2 style="margin:0;">Resultados inmediatos</h2>
          <div class="meta">Intento finalizado el ${new Date(state.session.completedAt).toLocaleString("es-ES")}</div>
        </div>
        <div class="badge">Routing final: ${getModule(state.session.module2Selection)?.label || "—"}</div>
      </div>
      <div class="stats-list">
        <div class="stat"><span>Raw score</span><strong>${report.rawScore}/${report.total}</strong></div>
        <div class="stat"><span>Accuracy global</span><strong>${Math.round(report.overallAccuracy * 100)}%</strong></div>
        <div class="stat"><span>Errores revisables</span><strong>${report.errorReview.length}</strong></div>
        <div class="stat"><span>Intentos guardados</span><strong>${state.session.history.length}</strong></div>
      </div>
    </section>
    <section class="results-grid">
      <div class="panel">
        <h3 style="margin-top:0;">Accuracy por task type</h3>
        ${renderAccuracyTable(report.byTaskType)}
      </div>
      <div class="panel">
        <h3 style="margin-top:0;">Accuracy por skill type</h3>
        ${renderAccuracyTable(report.bySkillType)}
      </div>
      <div class="panel">
        <h3 style="margin-top:0;">Tiempo por pregunta</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Pregunta</th><th>Módulo</th><th>Tiempo</th><th>Resultado</th></tr></thead>
            <tbody>
              ${report.questions
                .map((question) => `
                  <tr>
                    <td>${question.orderLabel}</td>
                    <td>${getModule(question.moduleId)?.label || question.moduleId}</td>
                    <td>${formatTime(question.timeSpentMs)}</td>
                    <td>${isQuestionCorrect(question) ? "Correcta" : "Incorrecta"}</td>
                  </tr>`)
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <h3 style="margin-top:0;">Revisión de errores</h3>
        ${report.errorReview.length ? report.errorReview.map(renderReviewItem).join("") : `<div class="review-item correct"><strong>Excelente.</strong> No hubo errores en este intento.</div>`}
      </div>
    </section>
  `;
}

function renderAccuracyTable(rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Categoría</th><th>Correctas</th><th>Total</th><th>Accuracy</th></tr></thead>
        <tbody>
          ${rows
            .map((row) => `<tr><td>${row.label}</td><td>${row.correct}</td><td>${row.total}</td><td>${Math.round(row.accuracy * 100)}%</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReviewItem(question) {
  const learnerAnswer = question.type === "textGroup"
    ? question.answer.map((value, index) => `${index + 1}. ${value || "—"}`).join(" · ")
    : question.options[question.answer] || "Sin respuesta";
  const expected = question.type === "textGroup"
    ? question.correctAnswer.join(" · ")
    : question.options[question.correctAnswer];
  return `
    <div class="review-item">
      <strong>${question.orderLabel}</strong>
      <div class="meta">${question.taskType} · ${question.skillType}</div>
      <p><strong>Tu respuesta:</strong> ${learnerAnswer}</p>
      <p><strong>Respuesta correcta:</strong> ${expected}</p>
      <p><strong>Explicación:</strong> ${question.explanation}</p>
    </div>
  `;
}

function renderAdminPanel() {
  return `
    <section class="panel">
      <h2 style="margin-top:0;">Admin configurable</h2>
      <p class="meta">Ajusta timers, umbral de routing y composición de módulos sin tocar código de lógica.</p>
      <form id="admin-form" class="admin-grid">
        <label class="field">
          <span>Umbral de routing (%)</span>
          <input type="number" name="routingThreshold" min="10" max="95" value="${Math.round(state.config.routingThreshold * 100)}" />
        </label>
        <label class="field">
          <span>Duración Module 1 (min)</span>
          <input type="number" name="durationModule1" min="1" max="60" value="${state.config.moduleDurations.module1}" />
        </label>
        <label class="field">
          <span>Duración Module 2 Easy (min)</span>
          <input type="number" name="durationModule2Easy" min="1" max="60" value="${state.config.moduleDurations.module2Easy}" />
        </label>
        <label class="field">
          <span>Duración Module 2 Hard (min)</span>
          <input type="number" name="durationModule2Hard" min="1" max="60" value="${state.config.moduleDurations.module2Hard}" />
        </label>
        <div style="grid-column:1/-1; display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
          <button class="primary" type="submit">Aplicar configuración</button>
          <span class="warning">Aplicar configuración reinicia el intento actual.</span>
        </div>
      </form>
    </section>
  `;
}

function renderHistoryPanel() {
  const history = state.session.history || [];
  return `
    <section class="history-card">
      <h2 style="margin-top:0;">Historial de intentos</h2>
      <div class="history-list">
        ${history.length
          ? history
              .map(
                (item) => `
                  <div class="module-card">
                    <div>
                      <strong>${new Date(item.completedAt).toLocaleString("es-ES")}</strong>
                      <div class="meta">Routing: ${getModule(item.module2Selection)?.label || item.module2Selection}</div>
                    </div>
                    <div style="text-align:right;">
                      <div><strong>${item.rawScore}/${item.total}</strong></div>
                      <div class="meta">${Math.round(item.accuracy * 100)}%</div>
                    </div>
                  </div>`
              )
              .join("")
          : `<p class="meta">Todavía no hay intentos guardados.</p>`}
      </div>
    </section>
  `;
}

function bindEvents() {
  document.querySelector('[data-action="start"]')?.addEventListener("click", startExam);
  document.querySelector('[data-action="reset"]')?.addEventListener("click", resetExam);
  document.querySelector('[data-action="prev"]')?.addEventListener("click", () => navigateQuestion(-1));
  document.querySelector('[data-action="next"]')?.addEventListener("click", () => navigateQuestion(1));
  document.querySelector('[data-action="flag"]')?.addEventListener("click", () => toggleFlag(state.session.currentQuestionId));
  document.querySelector('[data-action="submit-module"]')?.addEventListener("click", () => submitCurrentModule(true));
  document.querySelectorAll("[data-question-id]").forEach((element) => {
    if (element.tagName === "BUTTON") {
      element.addEventListener("click", () => setCurrentQuestion(element.dataset.questionId));
      return;
    }
    if (element.type === "radio") {
      element.addEventListener("change", () => updateAnswer(element.dataset.questionId, Number(element.value)));
      return;
    }
    if (element.tagName === "INPUT") {
      element.addEventListener("input", () => {
        const question = getCurrentQuestion();
        const answers = Array.isArray(question.answer) ? [...question.answer] : Array(question.blanks.length).fill("");
        answers[Number(element.dataset.blankIndex)] = element.value;
        updateAnswer(element.dataset.questionId, answers);
      });
    }
  });
  document.getElementById("admin-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    applyAdminConfig(new FormData(event.currentTarget));
  });
}

function hasAnswer(question) {
  if (question.type === "textGroup") return Array.isArray(question.answer) && question.answer.some((value) => normalize(value));
  return question.answer !== null && question.answer !== undefined && String(question.answer) !== "";
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function clampInt(value, min, max) { return Math.round(clamp(value || min, min, max)); }

function createCompleteWordsTask() {
  return {
    id: "cw-campus",
    title: "Complete the Words",
    questions: [{
      id: "m1-cw-1",
      type: "textGroup",
      taskType: "Complete the Words",
      skillType: "Vocabulary decoding",
      prompt: "Completa la segunda mitad de cada palabra basándote en el contexto.",
      passage: "On the first day of class, Maya followed the campus map to the science building. She arrived early, organized her notes, and listened as the instructor described a weekly lab project. During the break, she introduced herself to two classmates, compared schedules, and wrote a reminder to review the reading before Thursday.",
      blanks: [
        makeBlank("cam", "Lugar donde estudia Maya", "pus"),
        makeBlank("sci", "Tipo de building", "ence"),
        makeBlank("buil", "La estructura a la que llega", "ding"),
        makeBlank("orga", "Cómo acomodó sus notas", "nized"),
        makeBlank("instr", "Persona que explicó el proyecto", "uctor"),
        makeBlank("wee", "Frecuencia del proyecto", "kly"),
        makeBlank("proj", "Actividad del laboratorio", "ect"),
        makeBlank("class", "Sus nuevos compañeros", "mates"),
        makeBlank("sche", "Lo que compararon", "dules"),
        makeBlank("Thu", "Día antes del cual debía estudiar", "rsday"),
      ],
      answer: Array(10).fill(""),
      correctAnswer: ["pus", "ence", "ding", "nized", "uctor", "kly", "ect", "mates", "dules", "rsday"],
      explanation: "Cada respuesta reconstruye una palabra del pasaje usando la pista semántica y el prefijo visible.",
    }],
  };
}

function createDailyShortTask() {
  const passage = "Lucía checks the weather before biking to work. When heavy rain is expected, she takes the subway instead and carries a small notebook to review vocabulary during the ride.";
  return {
    id: "daily-short-weather",
    title: "Reading in Daily Life Short",
    questions: [
      makeMulti("m1-ds-1", passage, "Why does Lucía sometimes take the subway?", ["She wants to meet a friend downtown.", "She expects bad weather for biking.", "She needs to buy a notebook first.", "She is studying at the station."], 1, "Reading in Daily Life Short", "Factual", "The passage directly states she changes plans when heavy rain is expected."),
      makeMulti("m1-ds-2", passage, "What does Lucía usually do during the ride?", ["She sleeps until work begins.", "She repairs her bicycle.", "She reviews vocabulary in a notebook.", "She checks train schedules for fun."], 2, "Reading in Daily Life Short", "Important idea", "The last clause explains how she uses the commute time productively."),
    ],
  };
}

function createDailyLongTask() {
  const passage = "After moving to a new apartment, Daniel created a simple evening routine. He cooks enough food for two days, washes the dishes immediately, and places his keys in a bowl near the door. On Sundays, he plans bus routes for the week so he can arrive at work and language class on time. The routine seemed unnecessary at first, but after one month he noticed that he felt calmer each morning and spent less money on takeout meals.";
  return {
    id: "daily-long-routine",
    title: "Reading in Daily Life Long",
    questions: [
      makeMulti("m1-dl-1", passage, "Which action helps Daniel avoid losing time before leaving home?", ["Cooking enough for two days.", "Washing dishes immediately.", "Putting keys in a bowl near the door.", "Taking language class on Sunday."], 2, "Reading in Daily Life Long", "Factual", "The key bowl near the door directly supports faster departures."),
      makeMulti("m1-dl-2", passage, "Why does Daniel plan bus routes on Sundays?", ["To choose scenic paths for exercise.", "To reach weekly commitments punctually.", "To visit new restaurants after class.", "To compare ticket prices with friends."], 1, "Reading in Daily Life Long", "Rhetorical purpose", "This detail explains the practical purpose of planning ahead."),
      makeMulti("m1-dl-3", passage, "What can be inferred about Daniel after one month?", ["He decided routines are always stressful.", "He stopped cooking at home completely.", "He benefited more than he first expected.", "He moved again to a quieter area."], 2, "Reading in Daily Life Long", "Inference", "The routine seemed unnecessary at first, but later produced clear benefits."),
    ],
  };
}

function createAcademicTaskA() {
  const passage = "In many coastal wetlands, mangrove trees create dense root systems that slow moving water. As the water loses speed, suspended particles settle to the bottom instead of drifting away. Over time, this process builds layers of soil that support insects, fish, and birds. Scientists also note that mangroves reduce the force of storm waves before those waves reach inland communities. However, the benefit depends on the width and health of the wetland. When large sections are removed for construction, water can move more quickly through the remaining channels, and the shoreline may erode faster than before. For this reason, some urban planners now treat mangrove restoration as infrastructure planning rather than only as environmental decoration.";
  return {
    id: "academic-mangroves",
    title: "Academic Reading",
    questions: [
      makeMulti("m1-ar-1", passage, "According to the passage, what happens when water slows in mangrove roots?", ["It becomes too warm for fish.", "Suspended particles settle to the bottom.", "Storm waves gain strength quickly.", "Construction materials float inland."], 1, "Academic Reading", "Factual", "The second sentence states this directly."),
      makeMulti("m1-ar-2", passage, "Which statement is NOT given as a benefit of mangroves?", ["They support wildlife habitats.", "They weaken some storm waves.", "They generate electricity for cities.", "They help build soil layers."], 2, "Academic Reading", "Negative factual", "Electricity generation is never mentioned."),
      makeMulti("m1-ar-3", passage, "The word 'suspended' in the passage is closest in meaning to:", ["floating", "hidden", "measured", "buried"], 0, "Academic Reading", "Vocabulary", "The particles are in the water, not yet settled."),
      makeMulti("m1-ar-4", passage, "Why does the author mention construction in the wetland?", ["To explain why mangroves are easy to replace.", "To show a condition that can reduce wetland protection.", "To argue that cities should stop building homes entirely.", "To compare modern and ancient coastlines."], 1, "Academic Reading", "Rhetorical purpose", "The example illustrates how removal harms wetland function."),
      makeMulti("m1-ar-5", passage, "What is the main idea of the passage?", ["Mangroves are visually attractive additions to parks.", "Wetland roots affect water movement and provide practical protection.", "Bird populations always depend on human planning decisions.", "Storms are the only reason shorelines erode."], 1, "Academic Reading", "Important idea", "The paragraph develops both ecological and protective functions of mangroves."),
    ],
  };
}

function createCompleteWordsTaskEasy() {
  return {
    id: "cw-market",
    title: "Complete the Words",
    questions: [{
      id: "m2e-cw-1",
      type: "textGroup",
      taskType: "Complete the Words",
      skillType: "Vocabulary decoding",
      prompt: "Completa las palabras del pasaje sobre una visita al mercado.",
      passage: "Every Saturday, Nora visits the neighborhood market before breakfast. She greets a fruit seller, compares prices, and chooses vegetables for the week. Because she keeps a short list on her phone, she rarely forgets important items and usually finishes shopping in less than thirty minutes.",
      blanks: [
        makeBlank("Satu", "Día de la semana", "rday"),
        makeBlank("neigh", "Tipo de market", "borhood"),
        makeBlank("break", "Momento del día", "fast"),
        makeBlank("fru", "Producto del seller", "it"),
        makeBlank("pri", "Lo que compara Nora", "ces"),
        makeBlank("vege", "Lo que compra para la semana", "tables"),
        makeBlank("pho", "Dispositivo donde guarda la lista", "ne"),
        makeBlank("rare", "Qué tan seguido olvida cosas", "ly"),
        makeBlank("impor", "Tipo de items", "tant"),
        makeBlank("minu", "Unidad de tiempo", "tes"),
      ],
      answer: Array(10).fill(""),
      correctAnswer: ["rday", "borhood", "fast", "it", "ces", "tables", "ne", "ly", "tant", "tes"],
      explanation: "Las respuestas completan vocabulario frecuente de vida diaria.",
    }],
  };
}

function createDailyShortTaskEasy() {
  const passage = "Ibrahim leaves a reusable bottle near the front door every night. In the morning, he fills it with cold water so he does not buy drinks during his commute.";
  return {
    id: "daily-short-bottle",
    title: "Reading in Daily Life Short",
    questions: [
      makeMulti("m2e-ds-1", passage, "Why does Ibrahim prepare the bottle at night?", ["To chill it in the freezer for sports.", "To remember it before leaving home.", "To share it with a coworker later.", "To clean the kitchen sink."], 1, "Reading in Daily Life Short", "Factual", "Placing it near the door helps him remember it."),
      makeMulti("m2e-ds-2", passage, "What problem does the bottle help Ibrahim avoid?", ["Missing the train entirely.", "Buying beverages on the way to work.", "Forgetting his lunch in the office.", "Studying without enough light."], 1, "Reading in Daily Life Short", "Important idea", "The last clause identifies the practical benefit."),
    ],
  };
}

function createDailyLongTaskEasy() {
  const passage = "Sofía recently started volunteering at a community library on Wednesday afternoons. Before each shift, she reads a short summary of the children’s book scheduled for story time. That habit helps her pronounce names correctly and ask better follow-up questions. She also arrives ten minutes early to arrange chairs in a semicircle, which makes it easier for late arrivals to find a place without interrupting the session. After several weeks, Sofía noticed that children who were usually quiet began raising their hands more often.";
  return {
    id: "daily-long-library",
    title: "Reading in Daily Life Long",
    questions: [
      makeMulti("m2e-dl-1", passage, "Why does Sofía read the summary before volunteering?", ["To choose a different book for the class.", "To improve how she leads story time.", "To shorten the session by ten minutes.", "To practice drawing illustrations."], 1, "Reading in Daily Life Long", "Rhetorical purpose", "The summary helps pronunciation and question quality."),
      makeMulti("m2e-dl-2", passage, "What is one effect of arranging chairs early?", ["Children can leave the room more quickly.", "Late arrivals can join with less disruption.", "Parents volunteer more often on Fridays.", "The books remain in better condition."], 1, "Reading in Daily Life Long", "Factual", "The passage explicitly says the seating reduces interruptions."),
      makeMulti("m2e-dl-3", passage, "What can be inferred about the children after several weeks?", ["They became more willing to participate.", "They stopped attending on Wednesdays.", "They preferred silent reading only.", "They asked to move the chairs outside."], 0, "Reading in Daily Life Long", "Inference", "Raising hands more often suggests increased participation."),
    ],
  };
}

function createDailyShortTaskTransit() {
  const passage = "Before catching the evening bus, Ken reviews the next day’s schedule on his phone. This habit helps him notice early meetings before he goes to sleep.";
  return {
    id: "daily-short-transit",
    title: "Reading in Daily Life Short",
    questions: [
      makeMulti("m2e-ds-3", passage, "When does Ken review his schedule?", ["After waking up late.", "Before boarding the evening bus.", "During the first meeting of the day.", "While cooking breakfast."], 1, "Reading in Daily Life Short", "Factual", "The opening phrase gives the timing."),
      makeMulti("m2e-ds-4", passage, "What is the main benefit of Ken’s habit?", ["He notices early commitments in advance.", "He memorizes bus advertisements faster.", "He avoids charging his phone at home.", "He chooses longer routes for practice."], 0, "Reading in Daily Life Short", "Important idea", "The habit helps him detect early meetings before sleep."),
    ],
  };
}

function createCompleteWordsTaskHard() {
  return {
    id: "cw-research",
    title: "Complete the Words",
    questions: [{
      id: "m2h-cw-1",
      type: "textGroup",
      taskType: "Complete the Words",
      skillType: "Vocabulary decoding",
      prompt: "Completa las palabras del pasaje sobre una presentación científica.",
      passage: "Before the conference began, Aiden revised the graphs in his presentation and checked whether each caption matched the data. He expected difficult questions from senior researchers, so he practiced concise explanations and prepared one extra slide showing the experiment’s limitations.",
      blanks: [
        makeBlank("confe", "Evento académico", "rence"),
        makeBlank("prese", "Material que mostrará", "ntation"),
        makeBlank("cap", "Texto bajo un gráfico", "tion"),
        makeBlank("da", "Información medida", "ta"),
        makeBlank("diffi", "Tipo de preguntas", "cult"),
        makeBlank("resea", "Quiénes harán preguntas", "rchers"),
        makeBlank("con", "Cómo practicó sus respuestas", "cise"),
        makeBlank("expla", "Lo que ensayó decir", "nations"),
        makeBlank("experi", "Origen de las limitaciones", "ment's"),
        makeBlank("limita", "Aspecto adicional del estudio", "tions"),
      ],
      answer: Array(10).fill(""),
      correctAnswer: ["rence", "ntation", "tion", "ta", "cult", "rchers", "cise", "nations", "ment's", "tions"],
      explanation: "El conjunto exige reconocer vocabulario académico más denso.",
    }],
  };
}

function createAcademicTaskB() {
  const passage = "Astronomers often estimate the composition of distant planets by examining how starlight changes as a planet passes in front of its star. During that event, a small fraction of the light filters through the planet’s atmosphere before reaching telescopes. Different gases absorb different wavelengths, so the resulting pattern can reveal whether water vapor, methane, or other substances are present. Yet the method has limits. Clouds can hide deeper atmospheric layers, and activity on the star itself may distort the signal. Because of these complications, researchers usually compare repeated observations instead of relying on a single measurement. In this way, they reduce the chance that a temporary event will be mistaken for a stable atmospheric feature.";
  return {
    id: "academic-exoplanets",
    title: "Academic Reading",
    questions: [
      makeMulti("m2h-ar-1", passage, "What allows astronomers to infer atmospheric composition?", ["The planet’s distance from nearby moons.", "Changes in starlight during a transit event.", "The color of telescope mirrors at night.", "The temperature of laboratory gases on Earth."], 1, "Academic Reading", "Factual", "The opening sentence names the key method."),
      makeMulti("m2h-ar-2", passage, "Why are different wavelengths important in the passage?", ["They show how quickly a planet spins.", "They prove every planet has methane.", "They help identify which gases absorb light.", "They determine the age of a telescope."], 2, "Academic Reading", "Vocabulary", "The passage connects wavelengths to gas-specific absorption patterns."),
      makeMulti("m2h-ar-3", passage, "Which of the following is mentioned as a limitation of the method?", ["Planets always move too fast to observe twice.", "Clouds can hide parts of an atmosphere.", "Stars stop producing light during transit.", "Methane cannot absorb any wavelength."], 1, "Academic Reading", "Negative factual", "Cloud cover is explicitly described as a limitation."),
      makeMulti("m2h-ar-4", passage, "Why do researchers compare repeated observations?", ["To avoid confusing temporary effects with stable features.", "To increase the number of planets around each star.", "To make clouds disappear from the atmosphere.", "To replace telescopes with computer models."], 0, "Academic Reading", "Inference", "The last sentence explains the reason for repeated observations."),
      makeMulti("m2h-ar-5", passage, "How are the final two sentences related to the rest of the passage?", ["They provide a historical background unrelated to the method.", "They introduce a second topic about telescope construction.", "They explain how scientists respond to the method’s limitations.", "They argue that planets without clouds are unimportant."], 2, "Academic Reading", "Paragraph relationships", "They extend the discussion from limits to a practical research response."),
    ],
  };
}

function createDailyShortTaskHard() {
  const passage = "Each Friday afternoon, Mei writes a brief summary of the week’s research tasks. On Monday, she reads the summary before opening email so she can focus on unfinished priorities first.";
  return {
    id: "daily-short-research",
    title: "Reading in Daily Life Short",
    questions: [
      makeMulti("m2h-ds-1", passage, "Why does Mei read the summary on Monday?", ["To finish high-priority work before distractions grow.", "To avoid attending the weekly meeting.", "To replace her calendar with email folders.", "To send the summary to another department."], 0, "Reading in Daily Life Short", "Inference", "Reading before email helps her focus on unfinished priorities."),
      makeMulti("m2h-ds-2", passage, "What is the important idea of the passage?", ["Research summaries must be several pages long.", "Email should always be opened first in the morning.", "A short planning habit supports better task management.", "Friday afternoons are the least productive time to work."], 2, "Reading in Daily Life Short", "Important idea", "The passage centers on a small routine that improves focus."),
    ],
  };
}

function makeBlank(prefix, clue, suffix) {
  return { prefix, clue, suffix };
}

function makeMulti(id, passage, prompt, options, correctAnswer, taskType, skillType, explanation) {
  return {
    id,
    type: "multi",
    passage,
    prompt,
    options,
    correctAnswer,
    answer: null,
    taskType,
    skillType,
    explanation,
  };
}
