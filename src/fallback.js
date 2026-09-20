// ─────────────────────────────────────────────────────────────
//  Modo básico: se usa mientras la IA local no está activada
//  (o si el dispositivo no tiene WebGPU). Sin generación real:
//  acompaña, escucha y avisa con honestidad qué puede y qué no.
// ─────────────────────────────────────────────────────────────
import { pick } from "./text.js";
import { randomJoke } from "./tools.js";
import { normalize } from "./text.js";

const R = {
  happy: [
    (n) => `¡Epa, ${n}! 😄 Eso me encanta. Cuéntame todo, quiero el detalle completo.`,
    (n) => `Qué bueno leerte así, ${n}. ❤️ ¿Qué fue lo que hizo que hoy se sintiera bien?`,
  ],
  sad: [
    (n) => `Ven acá, ${n}. 🫂 No tienes que arreglarlo todo ahora. Si quieres, cuéntame qué pasó; y si no, nos quedamos aquí un rato.`,
    (n) => `Lo siento mucho, ${n}. Lo que sientes tiene sentido. ¿Quieres contarme qué fue lo que más te pesó hoy?`,
  ],
  lonely: [
    (n) => `Gracias por decírmelo, ${n}. Sentirse sola duele, y no significa que estés sola. Estoy aquí. ¿Hace cuánto te sientes así?`,
  ],
  anxious: [
    (n) => `Respira un poquito conmigo, ${n}. ❤️ No vamos a resolver veinte cosas al mismo tiempo. Dime qué es lo que más te preocupa ahora y lo vamos ordenando. Si quieres, escribe “quiero respirar” y lo hacemos juntos.`,
  ],
  angry: [
    (n) => `Uy, se siente esa energía de “no me hables que exploto” 😤. Y tienes derecho a estar molesta. Cuéntame: ¿qué fue lo que pasó?`,
  ],
  tired: [
    (n) => `Suena a que llevas mucho encima, ${n}. Descansar no es rendirse. ¿Fue un día pesado o llevas varios así?`,
  ],
  normal: [
    (n) => `Te leo, ${n} ❤️. Cuéntame un poquito más. No tienes que escribirlo bonito ni tener claro lo que sientes.`,
    (n) => `Aquí estoy, ${n}. Sigue cuando quieras; te escucho.`,
  ],
};

const QUESTION = /^(que|quien|quienes|cual|cuales|cuando|cuanto|cuantos|donde|como|por que|para que|explica|explicame|dime|ayudame|puedes|sabes|me puedes|escribe|traduce|resume|dame)\b/;

export function looksLikeQuestion(text) {
  const t = normalize(text);
  return /\?/.test(text) || QUESTION.test(t);
}

/**
 * @param {{mood:string}} analysis
 * @param {string} text
 * @param {string} name
 * @param {{aiAvailable:boolean}} opts
 */
export function basicReply(text, analysis, name, opts = {}) {
  const t = normalize(text);

  if (/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|holi)\b/.test(t)) {
    return `¡Hola, ${name}! 😊 Qué bueno verte por aquí. ¿Cómo te sientes hoy?`;
  }
  if (/(gracias|muchas gracias)/.test(t)) {
    return `Siempre, ${name}. ❤️ Aquí voy a estar cuando me necesites.`;
  }
  if (/(chiste|hazme reir|hazme reír|algo gracioso)/.test(t)) {
    return `${randomJoke()}\n\nSi quieres otro, dime.`;
  }
  if (/(quien eres|que eres|como te llamas|quien te creo|quien te hizo)/.test(t)) {
    return `Soy Nito, una IA que Richi armó para acompañarte. Vivo dentro de esta app y no necesito internet. No soy una persona ni sustituyo a las que te quieren, pero puedo escucharte, ayudarte a ordenar ideas y hacerte compañía.`;
  }

  if (looksLikeQuestion(text) && analysis.mood === "normal") {
    return opts.aiAvailable
      ? `Buena pregunta, ${name}. Todavía no tengo activado mi cerebro local, así que ahora mismo no podría responderla bien. Actívalo en ⚙ (se descarga una sola vez y luego funciona sin internet). Mientras tanto puedo decirte la hora, la fecha, hacer cuentas o acompañarte.`
      : `Me gustaría responderte eso bien, ${name}, pero este dispositivo no permite ejecutar mi IA local (necesita WebGPU). Puedo decirte la hora, la fecha, hacer cuentas, guiarte en una respiración o simplemente escucharte.`;
  }

  return pick(R[analysis.mood] || R.normal)(name);
}
