// ─────────────────────────────────────────────────────────────
//  Motor generativo local. Envuelve WebLLM (WebGPU):
//  · la primera vez descarga los pesos del modelo (una sola vez);
//  · quedan en la caché del navegador y desde ahí todo funciona
//    sin internet, sin servidores y sin enviar datos a nadie.
// ─────────────────────────────────────────────────────────────
import { MODEL_TIERS, GENERATION } from "./config.js";

let webllmPromise = null;
const webllm = () => (webllmPromise ||= import("@mlc-ai/web-llm"));

/** ¿Puede este dispositivo ejecutar la IA local? */
export async function detectSupport() {
  if (!("gpu" in navigator)) return { webgpu: false, f16: false, reason: "Este navegador no tiene WebGPU." };
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { webgpu: false, f16: false, reason: "No se encontró una GPU compatible." };
    return { webgpu: true, f16: adapter.features.has("shader-f16"), reason: "" };
  } catch (e) {
    return { webgpu: false, f16: false, reason: "WebGPU no está disponible en este momento." };
  }
}

export function defaultTierId() {
  const mem = navigator.deviceMemory || 4; // Chrome lo expone (máx. 8); otros navegadores no
  return mem >= 6 ? "equilibrado" : "ligero";
}

export function tierById(id) {
  return MODEL_TIERS.find((t) => t.id === id) || MODEL_TIERS.find((t) => t.id === defaultTierId());
}

export function modelIdFor(tier, support) {
  return support?.f16 === false ? tier.f32 : tier.f16;
}

export class LocalLLM {
  constructor() {
    this.engine = null;
    this.worker = null;
    this.modelId = null;
    this.busy = false;
  }

  get ready() { return !!this.engine; }

  async isCached(modelId) {
    try { return await (await webllm()).hasModelInCache(modelId); } catch { return false; }
  }

  /** Carga (y descarga si hace falta) el modelo. onProgress({progress, text}) */
  async load(modelId, onProgress) {
    if (this.engine && this.modelId === modelId) return;
    await this.unload();
    const mod = await webllm();
    this.worker = new Worker(new URL("./llm.worker.js", import.meta.url), { type: "module" });
    try {
      this.engine = await mod.CreateWebWorkerMLCEngine(this.worker, modelId, {
        initProgressCallback: (p) => onProgress?.({ progress: p.progress ?? 0, text: p.text ?? "" }),
      });
      this.modelId = modelId;
    } catch (e) {
      this.worker?.terminate();
      this.worker = null; this.engine = null; this.modelId = null;
      throw e;
    }
  }

  async unload() {
    try { await this.engine?.unload(); } catch {}
    this.worker?.terminate();
    this.engine = null; this.worker = null; this.modelId = null;
  }

  async deleteFromCache(modelId) {
    if (this.modelId === modelId) await this.unload();
    await (await webllm()).deleteModelAllInfoInCache(modelId);
  }

  interrupt() { try { this.engine?.interruptGenerate(); } catch {} }

  /**
   * Genera una respuesta en streaming.
   * @param {{role:string, content:string}[]} messages
   * @param {(fullText:string)=>void} onToken
   * @returns {Promise<string>}
   */
  async chat(messages, onToken) {
    if (!this.engine) throw new Error("El modelo no está cargado");
    this.busy = true;
    let text = "";
    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: GENERATION.temperature,
        top_p: GENERATION.top_p,
        repetition_penalty: GENERATION.repetition_penalty,
        max_tokens: GENERATION.max_tokens,
      });
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) { text += delta; onToken?.(text); }
      }
    } finally {
      this.busy = false;
    }
    return text.trim();
  }
}
