import "@fontsource-variable/figtree";
import "@fontsource/caveat/latin-500.css";
import "@fontsource/caveat/latin-700.css";
import "./style.css";

import { APP, EMERGENCY, MODEL_TIERS, GENERATION } from "./config.js";
import { escapeHTML, formatMessage } from "./text.js";
import { assessSafety, crisisReply, dangerReply, watchReply } from "./safety.js";
import { analyzeEmotion } from "./emotion.js";
import { tryTools, BREATHING } from "./tools.js";
import { basicReply } from "./fallback.js";
import { buildSystemPrompt } from "./prompt.js";
import * as mem from "./memory.js";
import { LocalLLM, detectSupport, tierById, modelIdFor, defaultTierId } from "./llm.js";
import { showLetter } from "./ui/letter.js";

const app = document.querySelector("#app");
const $ = (sel, root = document) => root.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const llm = new LocalLLM();
const state = {
  name: mem.loadName(),
  messages: mem.loadMessages(),
  busy: false,
  generating: false,
  safetyTurns: 0,
  ai: {
    status: "checking", // checking | unsupported | idle | loading | ready | error
    progress: 0,
    detail: "",
    error: "",
    support: null,
    tierId: mem.loadTier() || defaultTierId(),
  },
};

/* ───────────────────────── Estructura ───────────────────────── */

function mount() {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="orb orb-sm" id="brandOrb" aria-hidden="true"></span>
          <div class="brand-text"><strong>Nito</strong><span id="brandFor"></span></div>
        </div>
        <div class="top-actions">
          <button class="pill" id="statusBtn" type="button"><i class="dot"></i><span id="statusText"></span></button>
          <button class="icon-btn" id="settingsBtn" type="button" aria-label="Ajustes">⚙</button>
          <button class="icon-btn" id="clearBtn" type="button" aria-label="Borrar conversación" title="Borrar conversación">↺</button>
        </div>
      </header>

      <section class="chat" id="chat" role="log" aria-live="polite"></section>

      <div class="chips" id="chips">
        <button type="button" class="chip" data-send="Quiero respirar">🫁 Respirar</button>
        <button type="button" class="chip" data-send="Necesito aterrizar (5-4-3-2-1)">🌿 Aterrizar</button>
        <button type="button" class="chip" data-send="Hazme reír">😂 Hazme reír</button>
        <button type="button" class="chip" data-send="Solo quiero desahogarme">💭 Desahogarme</button>
      </div>

      <form class="composer" id="form">
        <textarea id="input" rows="1" maxlength="2000" placeholder="Cuéntame algo…" enterkeyhint="send" autocomplete="off"></textarea>
        <button id="sendBtn" type="submit" aria-label="Enviar">➤</button>
      </form>
      <p class="safety-note">Nito acompaña; no sustituye ayuda profesional. Si hay peligro inmediato, busca a una persona cercana o llama al ${EMERGENCY.number}.</p>
    </main>
    <div id="overlay-root"></div>
    <dialog id="settings" class="sheet" aria-label="Ajustes"></dialog>
  `;
  $("#brandFor").textContent = `para ${state.name}`;
}

/* ───────────────────────── Mensajes ───────────────────────── */

function breatheHTML() {
  const { inhale, hold, exhale } = BREATHING.cycle;
  return `<div class="breathe" style="--in:${inhale}s;--hold:${hold}s;--out:${exhale}s;--cycle:${inhale + hold + exhale}s">
      <span class="breathe-orb"></span><span class="breathe-label">Inhala…</span></div>`;
}

function extraFor(m, isLast) {
  if (m.kind === "breathe") return isLast ? breatheHTML() : "";
  if (m.kind === "crisis" || m.kind === "danger") {
    return `<a class="call-btn" href="tel:${EMERGENCY.number}">📞 ${EMERGENCY.label}</a>`;
  }
  return "";
}

function bubbleHTML(m, isLast = false) {
  const side = m.role === "user" ? "user" : "bot";
  return `<div class="bubble-row ${side}"><div class="bubble">${formatMessage(m.text)}${extraFor(m, isLast)}</div></div>`;
}

function scrollDown(force = false) {
  const chat = $("#chat");
  const near = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 160;
  if (force || near) chat.scrollTop = chat.scrollHeight;
}

function startBreathing(widget) {
  if (!widget || widget.dataset.on) return;
  widget.dataset.on = "1";
  const { inhale, hold, exhale } = BREATHING.cycle;
  const total = inhale + hold + exhale;
  const label = $(".breathe-label", widget);
  let t = 0;
  const tick = () => {
    if (!widget.isConnected) return clearInterval(id);
    const p = t++ % total;
    label.textContent = p < inhale ? "Inhala…" : p < inhale + hold ? "Sostén…" : "Suelta despacio…";
  };
  const id = setInterval(tick, 1000);
  tick();
}

function renderChat() {
  const chat = $("#chat");
  if (!state.messages.length) {
    chat.innerHTML = welcomeHTML();
    return;
  }
  const last = state.messages.length - 1;
  chat.innerHTML = state.messages.map((m, i) => bubbleHTML(m, i === last)).join("");
  startBreathing($(".breathe", chat));
  scrollDown(true);
}

/** Añade una burbuja sin volver a pintar todo el chat. Devuelve el nodo de la burbuja. */
function appendBubble(m) {
  const chat = $("#chat");
  $(".welcome", chat)?.remove();
  chat.insertAdjacentHTML("beforeend", bubbleHTML(m, true));
  const row = chat.lastElementChild;
  startBreathing($(".breathe", row));
  scrollDown(true);
  return $(".bubble", row);
}

function showTyping() {
  if ($("#typing")) return;
  $("#chat").insertAdjacentHTML("beforeend",
    `<div class="bubble-row bot" id="typing"><div class="bubble typing"><i></i><i></i><i></i></div></div>`);
  $("#brandOrb").classList.add("thinking");
  scrollDown(true);
}
function hideTyping() {
  $("#typing")?.remove();
  $("#brandOrb").classList.remove("thinking");
}

/** Respuesta "fija" (herramientas, seguridad, modo básico). */
async function botSay(text, { kind, delay = 450 } = {}) {
  showTyping();
  await sleep(delay);
  hideTyping();
  const msg = { role: "assistant", text, ...(kind ? { kind } : {}) };
  state.messages.push(msg);
  appendBubble(msg);
  mem.saveMessages(state.messages);
}

/* ───────────────────────── Bienvenida ───────────────────────── */

function aiCardHTML() {
  const { status, progress, error, support } = state.ai;
  if (status === "ready" || status === "checking") return "";
  if (status === "unsupported") {
    return `<div class="ai-card"><p>${escapeHTML(support?.reason || "Este dispositivo no admite mi IA local.")} Uso el modo básico: puedo acompañarte, decirte la hora, hacer cuentas y guiarte en una respiración.</p></div>`;
  }
  if (status === "loading") {
    return `<div class="ai-card"><p>Despertando mi cerebro local… ${Math.round(progress * 100)} %</p>
      <div class="progress"><i style="width:${Math.round(progress * 100)}%"></i></div>
      <p class="fine">Puedes seguir hablando conmigo mientras tanto, en modo básico.</p></div>`;
  }
  return `<div class="ai-card">
      <p><strong>Mi cerebro local.</strong> Activa mi IA para que pueda conversar de verdad y responder tus preguntas. Se descarga <em>una sola vez</em> (necesita internet y datos ahora); después funciona sin conexión y nada sale de tu teléfono.</p>
      ${error ? `<p class="fine error">${escapeHTML(error)}</p>` : ""}
      <button type="button" class="btn primary" data-act="activate">${status === "error" ? "Reintentar" : "Activar mi IA local"}</button>
    </div>`;
}

function welcomeHTML() {
  const n = escapeHTML(state.name);
  const moods = ["😊 Bien", "😐 Normal", "😔 No muy bien", "😡 De mal genio", "😭 Necesito hablar"];
  return `<div class="welcome">
      <span class="orb orb-xl" aria-hidden="true"></span>
      <h1>Hola, ${n}</h1>
      <p>Estoy aquí para escucharte, acompañarte o hacerte reír un rato. También puedo ayudarte con preguntas y tareas.</p>
      <div class="moods">${moods.map((x) => `<button type="button" class="mood-btn" data-send="${escapeHTML(x)}">${x}</button>`).join("")}</div>
      <div id="aiCardSlot">${aiCardHTML()}</div>
    </div>`;
}

/* ───────────────────────── Conversación ───────────────────────── */

function historyForModel() {
  const list = state.messages
    .filter((m) => m.kind !== "breathe" && m.text)
    .slice(-GENERATION.historyTurns)
    .map((m) => ({ role: m.role, content: m.text }));
  while (list.length && list[0].role !== "user") list.shift();
  return list;
}

const cleanReply = (t) => String(t || "").replace(/^\s*(Nito|Asistente|Assistant)\s*:\s*/i, "").trim();

async function generateWithModel(safetyMode) {
  const system = buildSystemPrompt({ name: state.name, moodSummary: mem.moodSummary(), safety: safetyMode });
  const payload = [{ role: "system", content: system }, ...historyForModel()];
  const msg = { role: "assistant", text: "" };
  let bubble = null;

  state.messages.push(msg);
  state.generating = true;
  setComposerState();
  showTyping();
  try {
    const out = await llm.chat(payload, (partial) => {
      msg.text = cleanReply(partial);
      if (!msg.text) return;
      if (!bubble) { hideTyping(); bubble = appendBubble(msg); }
      else { bubble.innerHTML = formatMessage(msg.text); scrollDown(); }
    });
    msg.text = cleanReply(out) || msg.text;
    if (!msg.text) throw new Error("respuesta vacía");
    hideTyping();
    if (!bubble) appendBubble(msg); else bubble.innerHTML = formatMessage(msg.text);
    mem.saveMessages(state.messages);
    return true;
  } catch (err) {
    hideTyping();
    if (msg.text) { mem.saveMessages(state.messages); return true; } // se conserva lo generado
    state.messages.pop();
    bubble?.closest(".bubble-row")?.remove();
    console.warn("[Nito] fallo del modelo local:", err);
    return false;
  } finally {
    state.generating = false;
    setComposerState();
  }
}

async function respond(text) {
  const safety = assessSafety(text);

  if (safety.level === "high" || safety.level === "danger") {
    state.safetyTurns = 8;
    const high = safety.level === "high";
    await botSay(high ? crisisReply(state.name) : dangerReply(state.name), { kind: high ? "crisis" : "danger", delay: 350 });
    return;
  }

  const tool = tryTools(text);
  if (tool) { await botSay(tool.text, { kind: tool.kind, delay: 250 }); return; }

  const analysis = analyzeEmotion(text);
  mem.logMood(analysis.mood);

  let safetyMode = "none";
  if (safety.level === "watch") { state.safetyTurns = Math.max(state.safetyTurns, 6); safetyMode = "watch"; }
  else if (state.safetyTurns > 0) { safetyMode = "recent"; state.safetyTurns--; }

  if (llm.ready && (await generateWithModel(safetyMode))) return;

  if (safety.level === "watch") { await botSay(watchReply(state.name), { delay: 500 }); return; }
  await botSay(
    basicReply(text, analysis, state.name, { aiAvailable: state.ai.support?.webgpu !== false }),
    { delay: 550 },
  );
}

async function send(raw) {
  const text = String(raw || "").trim();
  if (!text || state.busy) return;
  state.busy = true;
  setComposerState();

  const userMsg = { role: "user", text };
  state.messages.push(userMsg);
  appendBubble(userMsg);
  mem.saveMessages(state.messages);

  const input = $("#input");
  input.value = ""; autoGrow();

  try { await respond(text); }
  catch (e) { console.error(e); hideTyping(); }
  finally { state.busy = false; setComposerState(); }
}

function setComposerState() {
  const btn = $("#sendBtn");
  if (!btn) return;
  btn.textContent = state.generating ? "■" : "➤";
  btn.setAttribute("aria-label", state.generating ? "Detener" : "Enviar");
  btn.classList.toggle("stop", state.generating);
  btn.disabled = state.busy && !state.generating;
}

function autoGrow() {
  const el = $("#input");
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

/* ───────────────────────── IA local ───────────────────────── */

const STATUS_TEXT = {
  checking: "Revisando…", unsupported: "Modo básico", idle: "Activar IA",
  loading: "Cargando", ready: "IA local", error: "Reintentar",
};

function updateAIUI() {
  const { status, progress } = state.ai;
  const pill = $("#statusBtn");
  if (pill) {
    pill.dataset.status = status;
    $("#statusText").textContent = status === "loading" ? `${Math.round(progress * 100)} %` : STATUS_TEXT[status];
    pill.title = status === "ready" ? "Funciona sin internet" : "Ajustes de la IA local";
  }
  const slot = $("#aiCardSlot");
  if (slot) slot.innerHTML = aiCardHTML();
  if ($("#settings")?.open) {
    if (settingsStatus !== status) renderSettings(); else patchSettingsProgress();
  }
}

// Durante la descarga solo se actualiza la barra (repintar el diálogo haría fallar los toques).
let settingsStatus = null;
function patchSettingsProgress() {
  const { status, progress } = state.ai;
  const bar = $("#settings .progress i");
  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
  const line = $("#settings .muted");
  if (line && status === "loading") line.textContent = `Cargando… ${Math.round(progress * 100)} %`;
}

function friendlyError(e) {
  const msg = String(e?.message || e);
  if (/memory|OOM|out of|allocate|buffer|device lost/i.test(msg))
    return "Este equipo se quedó sin memoria con ese modelo. Prueba uno más ligero.";
  if (/network|fetch|failed to|offline|load/i.test(msg))
    return "No se pudo descargar el modelo. Revisa tu conexión e inténtalo de nuevo (solo hace falta internet esta vez).";
  return "No pude iniciar la IA local en este dispositivo. Nito sigue en modo básico.";
}

async function activateAI({ download = true } = {}) {
  const ai = state.ai;
  if (ai.status === "loading") return;
  ai.support ||= await detectSupport();
  if (!ai.support.webgpu) { ai.status = "unsupported"; updateAIUI(); return; }

  const tier = tierById(ai.tierId);
  const modelId = modelIdFor(tier, ai.support);
  ai.status = "loading"; ai.progress = 0; ai.detail = ""; ai.error = "";
  updateAIUI();
  try {
    if (download) await navigator.storage?.persist?.();
    await llm.load(modelId, ({ progress, text }) => {
      ai.progress = progress; ai.detail = text; updateAIUI();
    });
    ai.status = "ready";
    mem.saveAiEnabled(true); mem.saveTier(tier.id);
  } catch (e) {
    console.warn("[Nito] no se pudo cargar el modelo:", e);
    ai.status = "error"; ai.error = friendlyError(e);
  }
  updateAIUI();
}

async function deleteModel() {
  const tier = tierById(state.ai.tierId);
  for (const id of [tier.f16, tier.f32]) {
    try { await llm.deleteFromCache(id); } catch (e) { console.warn("[Nito] no se pudo borrar", id, e); }
  }
  mem.saveAiEnabled(false);
  state.ai.status = state.ai.support?.webgpu === false ? "unsupported" : "idle";
  state.ai.progress = 0;
  updateAIUI();
}

/* ───────────────────────── Ajustes ───────────────────────── */

function renderSettings() {
  const dlg = $("#settings");
  const { status, progress, error, support, tierId } = state.ai;
  const loadedTier = MODEL_TIERS.find((t) => t.f16 === llm.modelId || t.f32 === llm.modelId)?.id;
  const sameLoaded = status === "ready" && loadedTier === tierId;

  const lines = {
    checking: "Revisando tu dispositivo…",
    unsupported: `${support?.reason || "Este dispositivo no admite la IA local."} Nito sigue funcionando en modo básico.`,
    idle: "Todavía no está activada. Nito funciona en modo básico.",
    loading: `Cargando… ${Math.round(progress * 100)} %`,
    ready: "Lista. Funciona sin internet, incluso en modo avión.",
    error: error || "No se pudo iniciar.",
  };
  const btnLabel = sameLoaded ? "IA local activa ✓" : status === "loading" ? "Cargando…" : status === "ready" ? "Cambiar a este modelo" : "Activar IA local";
  const disabled = sameLoaded || status === "loading" || status === "unsupported" || status === "checking";
  const focusedId = document.activeElement?.id;
  settingsStatus = status;

  dlg.innerHTML = `
    <div class="sheet-inner">
      <header class="sheet-head"><h2>Ajustes</h2><button type="button" class="icon-btn" id="closeSettings" aria-label="Cerrar">✕</button></header>

      <label class="field">Tu nombre
        <input id="nameInput" type="text" maxlength="24" value="${escapeHTML(state.name)}" autocomplete="off">
      </label>

      <section class="block">
        <h3>Cerebro local</h3>
        <p class="muted">${escapeHTML(lines[status])}</p>
        <div class="tiers" role="radiogroup" aria-label="Modelo">
          ${MODEL_TIERS.map((t) => `
            <label class="tier ${t.id === tierId ? "on" : ""}">
              <input type="radio" name="tier" value="${t.id}" ${t.id === tierId ? "checked" : ""}>
              <span><strong>${t.label}</strong><small>${t.desc} Necesita unos ${(t.vramMB / 1000).toFixed(1)} GB de memoria de GPU.</small></span>
            </label>`).join("")}
        </div>
        ${status === "loading" ? `<div class="progress"><i style="width:${Math.round(progress * 100)}%"></i></div>` : ""}
        <div class="row">
          <button type="button" class="btn primary" id="aiActivateBtn" ${disabled ? "disabled" : ""}>${btnLabel}</button>
          <button type="button" class="btn" id="aiDeleteBtn" ${status === "loading" ? "disabled" : ""}>Borrar modelo</button>
        </div>
        <p class="fine">La descarga necesita internet una sola vez. Después todo ocurre en tu dispositivo: la conversación no se envía a ningún servidor.</p>
      </section>

      <section class="block">
        <button type="button" class="btn ghost-danger" id="clearBtn2">Borrar conversación</button>
      </section>
    </div>`;
  if (focusedId && $("#" + focusedId, dlg)) $("#" + focusedId, dlg).focus();
}

function openSettings() {
  renderSettings();
  const dlg = $("#settings");
  if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
}

function clearConversation() {
  if (!confirm("¿Borrar la conversación de este dispositivo?")) return;
  state.messages = [];
  state.safetyTurns = 0;
  mem.clearMessages();
  renderChat();
}

/* ───────────────────────── Eventos ───────────────────────── */

function bindEvents() {
  $("#form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.generating) { llm.interrupt(); return; }
    send($("#input").value);
  });
  const input = $("#input");
  input.addEventListener("input", autoGrow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("#form").requestSubmit();
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-send],[data-act]");
    if (t?.dataset.send) send(t.dataset.send);
    if (t?.dataset.act === "activate") activateAI({ download: true });
  });

  $("#clearBtn").addEventListener("click", clearConversation);
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#statusBtn").addEventListener("click", openSettings);

  const dlg = $("#settings");
  dlg.addEventListener("click", (e) => {
    const id = e.target.id;
    if (id === "closeSettings" || e.target === dlg) dlg.close?.();
    if (id === "aiActivateBtn") activateAI({ download: true });
    if (id === "aiDeleteBtn" && confirm("¿Borrar el modelo descargado? Tendrás que descargarlo otra vez para usar la IA local.")) deleteModel();
    if (id === "clearBtn2") { dlg.close?.(); clearConversation(); }
  });
  dlg.addEventListener("change", (e) => {
    if (e.target.name === "tier") {
      state.ai.tierId = e.target.value; mem.saveTier(e.target.value); renderSettings();
    }
    if (e.target.id === "nameInput") {
      mem.saveName(e.target.value);
      state.name = mem.loadName();
      $("#brandFor").textContent = `para ${state.name}`;
      if (!state.messages.length) renderChat();
    }
  });
}

/* ───────────────────────── Arranque ───────────────────────── */

async function boot() {
  mount();
  bindEvents();
  renderChat();
  setComposerState();
  updateAIUI();

  // La carta aparece solo al iniciar la app; se cierra sola o con la X.
  showLetter({
    root: $("#overlay-root"),
    name: state.name,
    author: APP.author,
    durationMs: APP.letterDurationMs,
  });

  if (import.meta.env?.PROD) import("./pwa.js").catch(() => {});

  const ai = state.ai;
  ai.support = await detectSupport();
  if (!ai.support.webgpu) { ai.status = "unsupported"; updateAIUI(); return; }
  ai.status = "idle";
  updateAIUI();

  // Si ya se descargó antes, se despierta sola desde la caché (sin internet).
  if (mem.loadAiEnabled()) {
    const modelId = modelIdFor(tierById(ai.tierId), ai.support);
    if (await llm.isCached(modelId)) activateAI({ download: false });
  }
}

boot();
