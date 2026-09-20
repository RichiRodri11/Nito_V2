// Prueba de humo de la interfaz completa (jsdom) con un modelo simulado.
import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({ support: { webgpu: true, f16: true, reason: "" }, chatCalls: [], cached: false }));

vi.mock("../src/llm.js", async () => {
  const actual = await vi.importActual("../src/llm.js");
  class LocalLLM {
    _ready = false; modelId = null;
    get ready() { return this._ready; }
    async isCached() { return h.cached; }
    async load(id, cb) { cb?.({ progress: 0.5, text: "x" }); cb?.({ progress: 1, text: "ok" }); this._ready = true; this.modelId = id; }
    async unload() { this._ready = false; }
    async deleteFromCache() {}
    interrupt() {}
    async chat(messages, onToken) {
      h.chatCalls.push(messages);
      let t = "";
      for (const w of ["Claro,", " aquí", " estoy", " contigo."]) { t += w; onToken(t); }
      return t;
    }
  }
  return { ...actual, LocalLLM, detectSupport: async () => h.support };
});

const flush = () => new Promise((r) => setTimeout(r, 0));
async function boot() {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  localStorage.clear();
  Element.prototype.scrollTo ||= () => {};
  await import("../src/main.js");
  await vi.waitFor(() => expect(document.querySelector("#statusText").textContent).not.toBe("Revisando…"));
}
const type = async (text) => {
  const input = document.querySelector("#input");
  input.value = text;
  document.querySelector("#form").requestSubmit();
  await flush();
};
const bubbles = () => [...document.querySelectorAll(".bubble-row:not(#typing) .bubble")].map((b) => b.textContent);

beforeEach(() => { h.support = { webgpu: true, f16: true, reason: "" }; h.chatCalls = []; h.cached = false; });

describe("Nito (interfaz completa)", () => {
  it("al iniciar: muestra la carta, la bienvenida y ofrece activar la IA", async () => {
    await boot();
    expect(document.querySelector(".letter-card").textContent).toContain("Te amo");
    expect(document.querySelector(".welcome h1").textContent).toBe("Hola, Nita");
    expect(document.querySelector("#statusText").textContent).toBe("Activar IA");
    expect(document.querySelector('[data-act="activate"]')).not.toBeNull();
  });

  it("la X cierra la carta y no vuelve a aparecer al escribir", async () => {
    await boot();
    document.querySelector(".letter-x").click();
    await vi.waitFor(() => expect(document.querySelector(".letter-layer")).toBeNull(), { timeout: 1500 });
    await type("hola");
    await vi.waitFor(() => expect(bubbles().length).toBe(2), { timeout: 2000 });
    expect(document.querySelector(".letter-layer")).toBeNull();
  });

  it("activa la IA local y responde en streaming con el prompt de sistema", async () => {
    await boot();
    document.querySelector('[data-act="activate"]').click();
    await vi.waitFor(() => expect(document.querySelector("#statusText").textContent).toBe("IA local"));
    await type("¿Por qué el cielo es azul?");
    await vi.waitFor(() => expect(bubbles().at(-1)).toBe("Claro, aquí estoy contigo."), { timeout: 2000 });
    expect(h.chatCalls).toHaveLength(1);
    const [sys, ...rest] = h.chatCalls[0];
    expect(sys.role).toBe("system");
    expect(sys.content).toContain("Eres Nito");
    expect(rest.at(-1)).toEqual({ role: "user", content: "¿Por qué el cielo es azul?" });
    // persistencia local
    expect(JSON.parse(localStorage.getItem("nito_messages")).length).toBe(2);
  });

  it("crisis: respuesta fija con botón al 123 y sin llamar al modelo", async () => {
    await boot();
    document.querySelector('[data-act="activate"]').click();
    await vi.waitFor(() => expect(document.querySelector("#statusText").textContent).toBe("IA local"));
    await type("quiero morir");
    await vi.waitFor(() => expect(document.querySelector("a.call-btn")).not.toBeNull(), { timeout: 2000 });
    expect(document.querySelector("a.call-btn").getAttribute("href")).toBe("tel:123");
    expect(h.chatCalls).toHaveLength(0);
  });

  it("la calculadora local responde sin pasar por el modelo", async () => {
    await boot();
    document.querySelector('[data-act="activate"]').click();
    await vi.waitFor(() => expect(document.querySelector("#statusText").textContent).toBe("IA local"));
    await type("cuánto es 15 por 4");
    await vi.waitFor(() => expect(bubbles().at(-1)).toBe("El resultado es 60."), { timeout: 2000 });
    expect(h.chatCalls).toHaveLength(0);
  });

  it("respiración guiada: aparece el widget animado", async () => {
    await boot();
    await type("Quiero respirar");
    await vi.waitFor(() => expect(document.querySelector(".breathe")).not.toBeNull(), { timeout: 2000 });
    expect(document.querySelector(".breathe-label").textContent).toBe("Inhala…");
  });

  it("sin WebGPU: modo básico honesto", async () => {
    h.support = { webgpu: false, f16: false, reason: "Este navegador no tiene WebGPU." };
    await boot();
    expect(document.querySelector("#statusText").textContent).toBe("Modo básico");
    await type("¿Quién descubrió América?");
    await vi.waitFor(() => expect(bubbles().at(-1)).toMatch(/WebGPU/), { timeout: 2000 });
  });

  it("si la IA ya estaba descargada, despierta sola desde la caché", async () => {
    h.cached = true;
    vi.resetModules();
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    localStorage.setItem("nito_ai_enabled", "true");
    await import("../src/main.js");
    await vi.waitFor(() => expect(document.querySelector("#statusText").textContent).toBe("IA local"), { timeout: 2000 });
  });

  it("los ajustes permiten cambiar el nombre", async () => {
    await boot();
    document.querySelector("#settingsBtn").click();
    const nameInput = document.querySelector("#nameInput");
    nameInput.value = "Nita Rosa";
    nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelector("#brandFor").textContent).toBe("para Nita Rosa");
    expect(document.querySelector(".welcome h1").textContent).toBe("Hola, Nita Rosa");
  });
});
