// Página puente de la extensión. WhatsApp Web no deja incrustar sitios de afuera, pero sí una página
// de la propia extensión: esta carga el panel del CRM y le pasa cuál es el chat abierto.
// No guarda nada: solo reenvía { ac: "chat" } hacia el CRM.
const BASE_FIJA = "https://www.argencargo.com.ar";
const WA = "https://web.whatsapp.com";
const marco = document.getElementById("crm");
let base = BASE_FIJA;
let ultimo = null;

const mandar = () => { if (ultimo && marco.contentWindow) marco.contentWindow.postMessage(ultimo, base); };

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || typeof d !== "object") return;
  if (e.origin === WA && d.ac === "chat") { ultimo = { ac: "chat", id: d.id, chat: d.chat || null }; mandar(); }
  else if (e.origin === base && d.ac === "listo") mandar();
});

// "base" solo se usa para probar contra otro servidor (se guarda a mano en chrome.storage.local).
chrome.storage.local.get("base", (r) => {
  if (typeof r?.base === "string" && /^https?:\/\/[^/]+$/.test(r.base)) base = r.base;
  marco.src = `${base}/crm/panel`;
  window.parent.postMessage({ ac: "puente" }, WA);
});
