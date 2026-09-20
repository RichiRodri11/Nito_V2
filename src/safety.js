// ─────────────────────────────────────────────────────────────
//  Capa de seguridad. Es determinista (no usa el modelo):
//  en una crisis la respuesta NUNCA depende de que una IA pequeña
//  "acierte". Trabaja sobre texto normalizado (sin tildes).
// ─────────────────────────────────────────────────────────────
import { normalize } from "./text.js";
import { EMERGENCY, APP } from "./config.js";

// Señales claras de riesgo de hacerse daño → respuesta fija.
const HIGH = [
  /quiero morir/, /quiero morirme/, /quisiera morir/, /me quiero morir/,
  /quiero matarme/, /me quiero matar/, /me voy a matar/, /voy a matarme/,
  /suicid/, /quitarme la vida/, /acabar con mi vida/, /terminar con mi vida/,
  /acabar con todo/, /hacerme dano/, /hacerme un dano/, /lastimarme/,
  /cortarme/, /no quiero vivir/, /no quiero seguir viviendo/,
  /ya no quiero estar aqui/, /quiero desaparecer/, /desaparecer para siempre/,
  /seria mejor no estar/, /mejor sin mi/, /no vale la pena vivir/,
  /no le encuentro sentido a (mi vida|vivir)/, /pensando en morir/,
];

// Violencia o peligro venido de otra persona → orientar a ayuda real.
const DANGER = [
  /me pega/, /me golpea/, /me golpeo/, /me esta agrediendo/, /me agrede/,
  /me amenaza/, /me amenazo/, /tengo miedo de (el|ella|mi pareja)/,
  /me obligo a/, /abusaron de mi/, /abuso de mi/, /me acosa/,
];

// Ambiguas: no se corta la conversación, pero el modelo recibe la instrucción
// de preguntar con cuidado y de forma directa por su seguridad.
const WATCH = [
  /ya no puedo mas/, /no puedo seguir asi/, /no aguanto mas/, /estoy harta de todo/,
  /nadie me necesita/, /soy una carga/, /no le importo a nadie/, /todo da igual/,
  /no tengo ganas de nada/, /me quiero ir de aqui/,
];

/**
 * @returns {{level: "high"|"danger"|"watch"|"none"}}
 */
export function assessSafety(text) {
  const t = normalize(text);
  if (HIGH.some((r) => r.test(t))) return { level: "high" };
  if (DANGER.some((r) => r.test(t))) return { level: "danger" };
  if (WATCH.some((r) => r.test(t))) return { level: "watch" };
  return { level: "none" };
}

export function crisisReply(name = APP.defaultUserName) {
  return (
    `${name}, gracias por decírmelo. Te leo en serio y me importa lo que te pasa. ❤️\n\n` +
    `Necesito preguntarte algo directo: ¿estás a salvo en este momento?\n\n` +
    `Si sientes que podrías hacerte daño ahora mismo, por favor haz esto:\n` +
    `• Aléjate de cualquier cosa con la que podrías lastimarte.\n` +
    `• Busca a una persona de confianza que pueda estar contigo, en persona o por llamada. Puede ser Richi o alguien de tu familia.\n` +
    `• Si el peligro es inmediato, llama al ${EMERGENCY.number}.\n\n` +
    `No tienes que cargar esto sola. Yo sigo aquí contigo mientras tanto: cuéntame cómo estás.`
  );
}

export function dangerReply(name = APP.defaultUserName) {
  return (
    `${name}, lo que cuentas es serio y no es tu culpa. ❤️\n\n` +
    `Tu seguridad va primero. Si estás en peligro ahora mismo, llama al ${EMERGENCY.number} o ve a un lugar donde haya otras personas. ` +
    `Si puedes, avísale ya a alguien de confianza.\n\n` +
    `Yo estoy aquí para escucharte. ¿Estás a salvo en este momento?`
  );
}

export function watchReply(name = APP.defaultUserName) {
  return (
    `${name}, siento que estás cargando algo muy pesado y me alegra que me lo cuentes. ❤️\n\n` +
    `Quiero preguntártelo con cariño y sin rodeos: ¿estás pensando en hacerte daño o sientes que no estás a salvo?\n\n` +
    `Si en algún momento sientes peligro, llama al ${EMERGENCY.number} o busca a alguien de confianza. Y cuéntame: ¿qué fue lo que más te pesó hoy?`
  );
}

/** Instrucción extra para el modelo cuando hay señales ambiguas o una crisis reciente. */
export function safetyNote(level) {
  if (level === "watch" || level === "recent") {
    return (
      "ATENCIÓN: la persona mostró señales de mucho sufrimiento. Valida con calidez, " +
      "pregunta de forma directa y tranquila si está pensando en hacerse daño o si está a salvo, " +
      "y recuérdale que puede buscar a alguien de confianza o llamar al " + EMERGENCY.number + " si hay peligro."
    );
  }
  return "";
}
