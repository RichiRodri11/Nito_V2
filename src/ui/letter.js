// ─────────────────────────────────────────────────────────────
//  La carta de Richi.
//  · Aparece SOLO al iniciar la app (una vez por arranque).
//  · Es temporal: se cierra sola al terminar la barra inferior.
//  · La X (primer elemento de la carta) la cierra al instante.
//  · Mantener el dedo/cursor encima pausa el tiempo para poder releerla.
// ─────────────────────────────────────────────────────────────
import { escapeHTML } from "../text.js";

let shownThisLaunch = false;

export function showLetter({ root, name, author, durationMs = 16000, onClose } = {}) {
  if (shownThisLaunch || !root) return null;
  shownThisLaunch = true;

  const layer = document.createElement("div");
  layer.className = "letter-layer";
  layer.innerHTML = `
    <article class="letter-card" role="dialog" aria-label="Carta de ${escapeHTML(author)}" tabindex="-1">
      <button type="button" class="letter-x" aria-label="Cerrar carta">✕</button>
      <h2 class="letter-to">Para ${escapeHTML(name)} ❤️</h2>
      <p class="letter-body">Si algún día me necesitas y no puedo estar contigo, abre esto.<br>
      No reemplaza un abrazo mío, pero quiero que recuerdes que siempre puedes contar conmigo.</p>
      <p class="letter-love">Te amo. ❤️</p>
      <p class="letter-sign">— ${escapeHTML(author)}</p>
      <div class="letter-timer" aria-hidden="true"><i style="animation-duration:${durationMs}ms"></i></div>
    </article>`;
  root.appendChild(layer);

  const card = layer.querySelector(".letter-card");
  const bar = layer.querySelector(".letter-timer i");
  let remaining = durationMs;
  let startedAt = Date.now();
  let timer = null;
  let closed = false;

  const arm = () => {
    startedAt = Date.now();
    timer = setTimeout(close, remaining);
    bar.style.animationPlayState = "running";
  };
  const pause = () => {
    if (closed || timer == null) return;
    clearTimeout(timer); timer = null;
    remaining = Math.max(800, remaining - (Date.now() - startedAt));
    bar.style.animationPlayState = "paused";
  };
  const resume = () => { if (!closed && timer == null) arm(); };

  function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    layer.classList.add("is-closing");
    setTimeout(() => { layer.remove(); onClose?.(); }, 420);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  layer.querySelector(".letter-x").addEventListener("click", close);
  layer.addEventListener("pointerdown", (e) => { if (e.target === layer) close(); }); // tocar fuera también cierra
  card.addEventListener("pointerenter", pause);
  card.addEventListener("pointerleave", resume);
  card.addEventListener("pointerdown", pause);
  card.addEventListener("pointerup", resume);
  document.addEventListener("keydown", onKey);

  arm();
  return { close, element: layer };
}

/** Solo para pruebas. */
export function _resetLetterForTests() { shownThisLaunch = false; }
