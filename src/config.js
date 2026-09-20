// ─────────────────────────────────────────────────────────────
//  Configuración central de Nito. Todo lo "personal" vive aquí.
// ─────────────────────────────────────────────────────────────

export const APP = {
  name: "Nito",
  defaultUserName: "Nita",
  author: "Richi",
  // Cuánto dura la carta en pantalla al abrir la app (ms). La X la cierra antes.
  letterDurationMs: 16000,
};

// Revisa que estos números sean los de tu país/ciudad antes de publicar.
export const EMERGENCY = {
  number: "123", // Línea única de emergencias en Colombia
  label: "Llamar al 123",
};

// Modelos que corren 100 % en el dispositivo (WebLLM · WebGPU).
// f16 = GPU con soporte shader-f16 (la mayoría). f32 = respaldo para GPU sin f16.
// vramMB sale de la configuración oficial de WebLLM.
export const MODEL_TIERS = [
  {
    id: "ligero",
    label: "Ligero",
    desc: "Para celulares modestos. Responde rápido.",
    f16: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    f32: "Llama-3.2-1B-Instruct-q4f32_1-MLC",
    vramMB: 880,
  },
  {
    id: "equilibrado",
    label: "Equilibrado",
    desc: "El mejor punto medio entre velocidad y calidad.",
    f16: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    f32: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
    vramMB: 1630,
  },
  {
    id: "potente",
    label: "Potente",
    desc: "Respuestas más sólidas. Necesita un equipo con buena GPU.",
    f16: "Qwen2.5-3B-Instruct-q4f16_1-MLC",
    f32: "Qwen2.5-3B-Instruct-q4f32_1-MLC",
    vramMB: 2505,
  },
];

export const GENERATION = {
  temperature: 0.7,
  top_p: 0.9,
  repetition_penalty: 1.08,
  max_tokens: 420,
  historyTurns: 12, // mensajes previos que ve el modelo
};

export const STORAGE_KEYS = {
  messages: "nito_messages",
  name: "nito_name",
  moods: "nito_moods",
  tier: "nito_tier",
  aiEnabled: "nito_ai_enabled",
};
