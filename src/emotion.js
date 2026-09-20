// Analizador emocional local: ligero, sin red, tolerante a tildes y a errores comunes.
import { normalize } from "./text.js";

const LEX = {
  happy: [
    /feliz/, /content[oa]/, /genial/, /excelente/, /alegr/, /logre/, /celebr/, /jaja/, /jeje/,
    /me fue (muy )?bien/, /muy bien/, /emocionad[oa]/, /orgullos[oa]/, /gracias a dios/, /buenas noticias/, /lo consegui/,
  ],
  sad: [
    /triste/, /llor/, /deprim/, /vacio/, /vacia/, /extran(o|a|ar)\b/, /desanimad[oa]/,
    /sin ganas/, /decepcion/, /destrozad[oa]/, /roto/, /rota/, /no muy bien/, /no me siento bien/,
    /no estoy bien/, /mal dia/, /me siento mal/, /necesito hablar/,
  ],
  lonely: [/(me siento|estoy|ando|me quede|muy|tan) sol[oa]\b/, /soledad/, /nadie me (escucha|quiere|entiende|busca|llama)/, /me siento aislad/, /sin nadie/],
  anxious: [
    /ansied/, /ansios/, /estres/, /stress/, /agobi/, /preocup/, /miedo/, /nervios/, /panico/,
    /no puedo respirar/, /me tiembla/, /taquicardia/, /abrumad[oa]/, /demasiadas cosas/, /no puedo dormir/,
  ],
  angry: [
    /enoj/, /rabia/, /furia/, /odio/, /mal genio/, /harta/, /harto/, /me molesta/, /me tiene cansad/, /irrit/, /fastidi/,
  ],
  tired: [/cansad[oa]/, /agotad[oa]/, /sin energia/, /no doy mas/, /dormi mal/, /muero de sueno/],
};

// Sin "muy bien/bien" aquí: "no estoy bien" ya lo cubre la lista de tristeza.
const INTENSIFIERS = /(muchisimo|demasiado|super|tan |nunca|siempre|todo el tiempo|no aguanto|insoportable|horrible)/;

const BUTTON_MOODS = {
  "😊 bien": "happy",
  "😐 normal": "normal",
  "😔 no muy bien": "sad",
  "😡 de mal genio": "angry",
  "😭 necesito hablar": "sad",
};

export function analyzeEmotion(text) {
  const raw = String(text || "").trim().toLowerCase();
  if (BUTTON_MOODS[raw]) return { mood: BUTTON_MOODS[raw], intensity: 1 };

  const t = normalize(text);
  // "no estoy feliz / no me siento tranquila" → invierte a tristeza.
  if (/\bno (estoy|me siento|me encuentro|ando) (muy |tan )?(bien|feliz|content[oa]|tranquil[oa]|ok)\b/.test(t)) {
    return { mood: "sad", intensity: INTENSIFIERS.test(t) ? 2 : 1 };
  }

  let best = { mood: "normal", score: 0 };
  for (const [mood, patterns] of Object.entries(LEX)) {
    const score = patterns.reduce((n, r) => n + (r.test(t) ? 1 : 0), 0);
    if (score > best.score) best = { mood, score };
  }
  const intensity = Math.min(3, 1 + (INTENSIFIERS.test(t) ? 1 : 0) + (best.score >= 2 ? 1 : 0));
  return { mood: best.mood, intensity };
}

export const MOOD_LABEL = {
  happy: "alegría", sad: "tristeza", lonely: "soledad", anxious: "ansiedad",
  angry: "enojo", tired: "cansancio", normal: "ánimo neutro",
};
