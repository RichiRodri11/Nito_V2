# Nito · IA de apoyo emocional que funciona sin internet

Nito es un compañero de apoyo emocional con **IA generativa local**: el modelo de lenguaje corre dentro del
navegador del dispositivo (WebGPU), así que después de una descarga inicial única **no necesita internet ni
servidores**, y la conversación nunca sale del teléfono o del computador.

## Cómo ejecutarlo

```bash
npm install
npm run dev        # desarrollo  → http://localhost:5173
npm test           # 54 pruebas (lógica, seguridad, carta temporal e interfaz completa)
npm run build      # producción  → carpeta dist/
npm run preview    # probar el build (con service worker)
```

Para instalarlo en el celular, publica `dist/` en un hosting con **HTTPS** (Netlify, Vercel, GitHub Pages,
Cloudflare Pages…). WebGPU y el service worker solo funcionan en HTTPS (o en `localhost`).
Abre la URL una vez con internet → "Añadir a pantalla de inicio" → toca **Activar mi IA local** y espera la descarga.
Desde ese momento funciona en modo avión.

## Cómo funciona (capas)

| Capa | Archivo | Qué hace |
|---|---|---|
| Seguridad | `src/safety.js` | Detecta riesgo de hacerse daño o violencia. Responde con texto fijo + botón al 123. **No depende del modelo.** |
| Herramientas | `src/tools.js` | Hora, fecha, calculadora segura (sin `eval`), respiración guiada, ejercicio 5-4-3-2-1. Exactas y sin IA. |
| Emociones | `src/emotion.js` | Clasifica el ánimo (tolerante a tildes y negaciones). Solo se guarda la etiqueta, no el texto. |
| Cerebro (IA) | `src/llm.js`, `src/llm.worker.js`, `src/prompt.js` | WebLLM en un Web Worker. Streaming, botón de detener, persona y límites en el prompt de sistema. |
| Modo básico | `src/fallback.js` | Respuestas de acompañamiento mientras la IA no está activada o si el equipo no tiene WebGPU. |
| Memoria | `src/memory.js` | Conversación y ánimo en `localStorage` (mismas claves que la versión anterior). |
| Carta | `src/ui/letter.js` | Aparece solo al abrir la app, se cierra sola (16 s) o con la **X**. Mantener el dedo encima pausa el tiempo. |
| App / PWA | `src/main.js`, `vite.config.js` | Interfaz, ajustes y caché offline (service worker generado por `vite-plugin-pwa`). |

Orden de decisión por cada mensaje: **seguridad → herramientas → IA local → modo básico**.

## Personalizar (`src/config.js`)

- `APP.letterDurationMs`: cuánto dura la carta.
- `EMERGENCY`: número de emergencias (revisa que sea el correcto para tu país/ciudad).
- `MODEL_TIERS`: modelos disponibles (Ligero · Equilibrado · Potente).
- `GENERATION`: temperatura, longitud máxima, cuántos mensajes recuerda el modelo.
- El texto de la carta está en `src/ui/letter.js`; la personalidad de Nito, en `src/prompt.js`.

## Límites (importante ser honestos)

- Un modelo de 1–3 mil millones de parámetros que corre en un celular **no equivale a ChatGPT**: responde bien
  conversación, ayuda de estudio y cultura general, pero puede equivocarse, no sabe lo que pasó después de su
  entrenamiento y no puede buscar en internet. Por eso el prompt le exige admitir cuando no sabe.
- Requiere un navegador con **WebGPU** (Chrome/Edge recientes en escritorio y Android; Safari reciente en iOS/macOS).
  Sin WebGPU, Nito queda en modo básico y lo dice.
- La primera descarga necesita internet y datos (cientos de MB según el modelo). Los pesos se guardan en la caché
  del navegador; si el usuario borra los datos del sitio, hay que descargarlos de nuevo.
- Nito no es terapia ni sustituye ayuda profesional. La capa de seguridad es una red de apoyo, no un diagnóstico.

## Alojar los pesos tú mismo (opcional)

Por defecto WebLLM descarga los pesos de Hugging Face la primera vez. Si quieres que **nada** dependa de un
tercero, sirve los archivos del modelo desde tu propio hosting y pasa un `appConfig` propio a
`CreateWebWorkerMLCEngine` en `src/llm.js` (ver la guía de WebLLM sobre `AppConfig` y `model_list`).
