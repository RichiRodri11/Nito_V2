// Memoria local de Nito. Todo se queda en este dispositivo (localStorage).
import { APP, STORAGE_KEYS as K } from "./config.js";
import { MOOD_LABEL } from "./emotion.js";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento lleno o bloqueado */ }
}

// ── Conversación ──
export const loadMessages = () => {
  const list = read(K.messages, []);
  return Array.isArray(list) ? list.filter((m) => m && typeof m.text === "string") : [];
};
export const saveMessages = (list) => write(K.messages, list.slice(-120));
export const clearMessages = () => { try { localStorage.removeItem(K.messages); } catch {} };

// ── Nombre ── (guardado como texto plano en versiones anteriores)
export function loadName() {
  try {
    const v = localStorage.getItem(K.name);
    return (v && v.trim()) || APP.defaultUserName;
  } catch { return APP.defaultUserName; }
}
export function saveName(name) {
  try { localStorage.setItem(K.name, (name || "").trim() || APP.defaultUserName); } catch {}
}

// ── Preferencias de IA ──
export const loadTier = () => read(K.tier, null);
export const saveTier = (id) => write(K.tier, id);
export const loadAiEnabled = () => read(K.aiEnabled, false) === true;
export const saveAiEnabled = (v) => write(K.aiEnabled, !!v);

// ── Diario de ánimo (solo etiquetas, nunca el texto) ──
const WEEK = 7 * 24 * 3600 * 1000;
export function logMood(mood, now = Date.now()) {
  if (!mood || mood === "normal") return;
  const list = read(K.moods, []).filter((e) => now - e.t < 30 * 24 * 3600 * 1000);
  list.push({ t: now, mood });
  write(K.moods, list.slice(-60));
}
export function moodSummary(now = Date.now()) {
  const recent = read(K.moods, []).filter((e) => now - e.t < WEEK);
  if (recent.length < 2) return "";
  const counts = {};
  for (const e of recent) counts[e.mood] = (counts[e.mood] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([m]) => MOOD_LABEL[m] || m);
  return `En los últimos días ha expresado sobre todo: ${top.join(" y ")}. Tenlo presente con delicadeza, sin mencionarlo como un dato.`;
}
