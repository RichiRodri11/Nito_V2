// ─────────────────────────────────────────────────────────────
//  Herramientas locales: cosas que un modelo pequeño hace mal
//  (hora, fecha, cuentas) o que deben ser exactas (respiración).
//  Se resuelven sin IA y sin internet.
// ─────────────────────────────────────────────────────────────
import { normalize, pick } from "./text.js";

const fmtNum = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 8 });

// ── Fecha y hora ──────────────────────────────────────────────
export function nowParts(d = new Date()) {
  return {
    fecha: new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
    hora: new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", hour12: true }).format(d),
  };
}

// ── Calculadora segura (sin eval) ─────────────────────────────
function parseExpression(src) {
  let i = 0;
  const peek = () => src[i];
  const eat = (c) => (src[i] === c ? (i++, true) : false);

  function number() {
    const m = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (!m) throw new Error("num");
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function primary() {
    if (eat("(")) {
      const v = expr();
      if (!eat(")")) throw new Error("paren");
      return v;
    }
    return number();
  }
  function postfix() {
    let v = primary();
    while (eat("%")) v /= 100;
    return v;
  }
  function unary() {
    if (eat("-")) return -unary();
    if (eat("+")) return unary();
    return postfix();
  }
  function power() {
    const base = unary();
    return eat("^") ? Math.pow(base, power()) : base;
  }
  function term() {
    let v = power();
    for (;;) {
      if (eat("*")) v *= power();
      else if (eat("/")) {
        const d = power();
        if (d === 0) throw new Error("div0");
        v /= d;
      } else return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      if (eat("+")) v += term();
      else if (eat("-")) v -= term();
      else return v;
    }
  }
  const out = expr();
  if (i !== src.length) throw new Error("trailing");
  return out;
}

const CALC_TRIGGER = /^(cuanto (es|da|son|seria)|calcula(r|me)?|resuelve|cuenta|cuanto vale|dime cuanto es)\b/;

export function tryCalculator(text) {
  let t = normalize(text).replace(/[?¿!¡=]+/g, " ").trim();
  const triggered = CALC_TRIGGER.test(t);
  t = t.replace(CALC_TRIGGER, "").trim();

  // "20% de 350" → "(20/100)*350"
  t = t.replace(/(\d+(?:[.,]\d+)?)\s*(%|por ciento) de (\d+(?:[.,]\d+)?)/g, "(($1)/100)*($3)");
  t = t
    .replace(/\bal cuadrado\b/g, "^2").replace(/\bal cubo\b/g, "^3")
    .replace(/\belevado a( la)?\b/g, "^")
    .replace(/\b(dividido (por|entre)|entre)\b/g, "/")
    .replace(/\b(multiplicado por|por|veces)\b/g, "*")
    .replace(/\bmas\b/g, "+").replace(/\bmenos\b/g, "-")
    .replace(/[×x·](?=\s*[\d(])/g, "*").replace(/÷/g, "/")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, "");

  if (!/^[\d+\-*/^().%]+$/.test(t) || !/\d/.test(t)) return null;
  const hasStrongOp = /[+*/^()]/.test(t);
  if (!triggered && !hasStrongOp) return null; // "12-05" solo es una fecha
  if (!triggered && !/\d[+\-*/^)]\(?-?\d/.test(t)) return null;

  try {
    const v = parseExpression(t);
    if (!Number.isFinite(v)) return null;
    return `${fmtNum.format(v)}`;
  } catch (e) {
    if (e.message === "div0") return "div0";
    return null;
  }
}

// ── Contenido de los ejercicios ───────────────────────────────
export const BREATHING = {
  intro:
    "Vamos a respirar juntos, sin prisa. Sigue el círculo: inhala cuando crece, sostén un momento y suelta despacio cuando se encoge. " +
    "Haz cuatro o cinco vueltas. Cuando termines, cuéntame cómo te sientes.",
  // inhalar 4 · sostener 2 · exhalar 6
  cycle: { inhale: 4, hold: 2, exhale: 6 },
};

export const GROUNDING =
  "Vamos a aterrizar con el ejercicio 5-4-3-2-1. Sin correr, dime o solo mira:\n\n" +
  "• 5 cosas que puedes ver\n• 4 cosas que puedes tocar\n• 3 sonidos que escuchas\n• 2 olores que percibes\n• 1 cosa que te gusta de ti\n\n" +
  "Tómate el tiempo que necesites. Si quieres, escríbeme lo que vas encontrando.";

const JOKES = [
  "¿Qué le dice un jaguar a otro jaguar? — Jaguar you? 😄",
  "¿Por qué los pájaros vuelan hacia el sur en invierno? Porque caminando tardarían muchísimo. 🐦",
  "¿Qué le dice un techo a otro techo? — Techo de menos. 🏠",
  "¿Cómo se despiden los químicos? — Ácido un placer. 🧪",
  "¿Por qué estaba triste el libro de matemáticas? Porque tenía muchos problemas. 📘",
  "¿Qué hace una abeja en el gimnasio? — ¡Zum-ba! 🐝",
];

// ── Enrutador de herramientas ─────────────────────────────────
/** @returns {{text: string, kind?: string} | null} */
export function tryTools(text) {
  const t = normalize(text).replace(/[?¿!¡.,]/g, "").trim();

  if (/(^|\s)(que hora es|que horas son|me dices la hora|hora actual)( ahora| ahorita)?$/.test(t)) {
    return { text: `Ahora son las ${nowParts().hora}.` };
  }
  if (/(que dia es( hoy)?|que fecha es( hoy)?|fecha de hoy|a cuanto estamos|que dia estamos)$/.test(t)) {
    return { text: `Hoy es ${nowParts().fecha}.` };
  }

  const calc = tryCalculator(text);
  if (calc === "div0") return { text: "Dividir entre cero no se puede. Ni yo ni ninguna calculadora del mundo. 😅" };
  if (calc) return { text: `El resultado es ${calc}.` };

  if (/(quiero respirar|respiracion|ejercicio de respir|necesito respirar|ayudame a respirar|calmarme)/.test(t)) {
    return { text: BREATHING.intro, kind: "breathe" };
  }
  if (/(aterrizar|grounding|5-4-3-2-1|5 4 3 2 1|tecnica de anclaje)/.test(t)) {
    return { text: GROUNDING };
  }
  return null;
}

/** Chiste sin IA (modo básico o respaldo). */
export function randomJoke() {
  return pick(JOKES);
}
