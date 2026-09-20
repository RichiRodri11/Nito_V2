import { describe, it, expect, beforeEach, vi } from "vitest";
import { assessSafety, crisisReply } from "../src/safety.js";
import { analyzeEmotion } from "../src/emotion.js";
import { tryTools, tryCalculator } from "../src/tools.js";
import { basicReply } from "../src/fallback.js";
import { buildSystemPrompt } from "../src/prompt.js";
import { formatMessage } from "../src/text.js";
import { showLetter, _resetLetterForTests } from "../src/ui/letter.js";

describe("seguridad", () => {
  it.each([
    "Quiero morir", "ya no quiero vivir", "me quiero MATAR", "he pensado en el suicidio",
    "quiero hacerme daño", "Quiero desaparecer para siempre", "voy a quitarme la vida",
  ])("detecta crisis: %s", (t) => expect(assessSafety(t).level).toBe("high"));

  it.each(["me pega y tengo miedo", "mi pareja me amenaza"])("detecta peligro externo: %s", (t) =>
    expect(assessSafety(t).level).toBe("danger"));

  it.each(["ya no puedo más", "siento que soy una carga"])("marca señales ambiguas: %s", (t) =>
    expect(assessSafety(t).level).toBe("watch"));

  it.each([
    "hoy me fue genial", "voy a borrar este archivo de mi escritorio",
    "cuánto es 2+2", "estoy cansada del trabajo", "no puedo seguir con este ejercicio de matemáticas",
  ])("no dispara falsas alarmas: %s", (t) => expect(assessSafety(t).level).toBe("none"));

  it("la respuesta de crisis incluye 123 y pregunta por seguridad", () => {
    const r = crisisReply("Nita");
    expect(r).toContain("123");
    expect(r).toMatch(/a salvo/);
  });
});

describe("emociones", () => {
  it("botones rápidos", () => {
    expect(analyzeEmotion("😔 No muy bien").mood).toBe("sad");
    expect(analyzeEmotion("😡 De mal genio").mood).toBe("angry");
    expect(analyzeEmotion("😊 Bien").mood).toBe("happy");
  });
  it("texto libre y tildes", () => {
    expect(analyzeEmotion("Estoy muy ansiosa, tengo mucho estrés").mood).toBe("anxious");
    expect(analyzeEmotion("me siento muy sola").mood).toBe("lonely");
    expect(analyzeEmotion("logré mi meta, estoy feliz").mood).toBe("happy");
    expect(analyzeEmotion("estoy agotada").mood).toBe("tired");
  });
  it("negaciones simples", () => {
    expect(analyzeEmotion("no estoy bien").mood).toBe("sad");
    expect(analyzeEmotion("no me siento feliz").mood).toBe("sad");
  });
  it("'solo' (adverbio) no es soledad", () => {
    expect(analyzeEmotion("solo quiero hablar").mood).not.toBe("lonely");
  });
});

describe("herramientas locales", () => {
  it.each([
    ["cuánto es 15 por 4", "60"],
    ["calcula 2+2*3", "8"],
    ["(2+3)*4", "20"],
    ["cuánto es 20% de 350", "70"],
    ["cuanto es 10 entre 4", "2,5"],
    ["cuánto es 2 elevado a 10", "1.024"],
    ["3 x 7", "21"],
    ["cuánto es 3,5 + 2", "5,5"],
    ["cuanto es -4 + 10", "6"],
  ])("%s → %s", (q, out) => expect(tryCalculator(q)).toBe(out));

  it("no calcula cosas que no son cuentas", () => {
    expect(tryCalculator("12-05")).toBeNull();
    expect(tryCalculator("tengo 2 hermanos")).toBeNull();
    expect(tryCalculator("cuánto es la capital de Francia")).toBeNull();
    expect(tryCalculator("5-4-3-2-1")).toBeNull();
  });
  it("división por cero", () => expect(tryCalculator("cuanto es 5/0")).toBe("div0"));
  it("no ejecuta código", () => {
    expect(tryCalculator("cuanto es process.exit()")).toBeNull();
    expect(tryCalculator("alert(1)")).toBeNull();
  });

  it("hora y fecha", () => {
    expect(tryTools("¿Qué hora es?").text).toMatch(/Ahora son las/);
    expect(tryTools("qué día es hoy").text).toMatch(/^Hoy es /);
    expect(tryTools("qué día es mi cumpleaños")).toBeNull();
  });
  it("respiración y aterrizaje", () => {
    expect(tryTools("Quiero respirar").kind).toBe("breathe");
    expect(tryTools("Necesito aterrizar (5-4-3-2-1)").text).toMatch(/5 cosas/);
  });
  it("conversación normal no activa herramientas", () => {
    expect(tryTools("hoy tuve un día difícil")).toBeNull();
  });
});

describe("modo básico y prompt", () => {
  it("responde por estado de ánimo y avisa cuando no puede responder preguntas", () => {
    expect(basicReply("hola", { mood: "normal" }, "Nita")).toMatch(/Hola, Nita/);
    expect(basicReply("¿Quién ganó el mundial de 1998?", { mood: "normal" }, "Nita", { aiAvailable: true })).toMatch(/cerebro local/);
    expect(basicReply("¿Quién ganó el mundial de 1998?", { mood: "normal" }, "Nita", { aiAvailable: false })).toMatch(/WebGPU/);
  });
  it("el prompt incluye persona, límites, fecha y aviso de seguridad", () => {
    const p = buildSystemPrompt({ name: "Nita", moodSummary: "ha expresado tristeza", safety: "watch" });
    expect(p).toMatch(/Eres Nito/);
    expect(p).toMatch(/No eres psicólogo/);
    expect(p).toMatch(/Hoy es /);
    expect(p).toMatch(/ATENCIÓN/);
    expect(p).toMatch(/tristeza/);
    expect(buildSystemPrompt({ name: "Nita" })).not.toMatch(/ATENCIÓN/);
  });
  it("formatMessage escapa HTML y convierte markdown simple", () => {
    expect(formatMessage("<img src=x onerror=alert(1)>")).not.toContain("<img");
    expect(formatMessage("**hola**\n- uno")).toBe("<strong>hola</strong><br>• uno");
  });
});

describe("carta temporal", () => {
  beforeEach(() => { document.body.innerHTML = '<div id="root"></div>'; _resetLetterForTests(); vi.useFakeTimers(); });

  const open = (extra = {}) => showLetter({ root: document.getElementById("root"), name: "Nita", author: "Richi", durationMs: 5000, ...extra });

  it("aparece con el texto y la X como primer control", () => {
    open();
    const card = document.querySelector(".letter-card");
    expect(card.textContent).toContain("Para Nita");
    expect(card.textContent).toContain("Te amo");
    expect(card.firstElementChild.classList.contains("letter-x")).toBe(true);
  });
  it("se cierra sola al terminar el tiempo", () => {
    const onClose = vi.fn();
    open({ onClose });
    vi.advanceTimersByTime(4900);
    expect(document.querySelector(".letter-layer")).not.toBeNull();
    vi.advanceTimersByTime(600);
    vi.advanceTimersByTime(500);
    expect(document.querySelector(".letter-layer")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("la X la cierra al instante", () => {
    open();
    document.querySelector(".letter-x").click();
    vi.advanceTimersByTime(500);
    expect(document.querySelector(".letter-layer")).toBeNull();
  });
  it("Escape la cierra", () => {
    open();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    vi.advanceTimersByTime(500);
    expect(document.querySelector(".letter-layer")).toBeNull();
  });
  it("solo se muestra una vez por arranque", () => {
    expect(open()).not.toBeNull();
    expect(open()).toBeNull();
    expect(document.querySelectorAll(".letter-layer").length).toBe(1);
  });
  it("mantener el puntero encima pausa el tiempo", () => {
    open();
    const card = document.querySelector(".letter-card");
    vi.advanceTimersByTime(2000);
    card.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(60000);
    expect(document.querySelector(".letter-layer")).not.toBeNull();
    card.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(3500);
    expect(document.querySelector(".letter-layer")).toBeNull();
  });
});
