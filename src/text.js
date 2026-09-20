// Utilidades de texto compartidas.

/** minúsculas + sin tildes: "Estoy TRISTE…" → "estoy triste…" */
export function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[c]));
}

/** Texto (posiblemente con markdown simple del modelo) → HTML seguro. */
export function formatMessage(raw = "") {
  let s = escapeHTML(raw);
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
  s = s.replace(/^\s*[-*•]\s+/gm, "• ");
  s = s.replace(/^#{1,4}\s+(.+)$/gm, "<strong>$1</strong>");
  return s.replace(/\n/g, "<br>");
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
