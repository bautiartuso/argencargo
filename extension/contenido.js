// ARGENCARGO CRM sobre WhatsApp Web.
// Mira qué chat está abierto (teléfono o nombre) y muestra al costado la ficha del CRM. Encima del
// chat dibuja una tira con las operaciones en curso y, arriba de la caja de texto, respuestas rápidas
// que ESCRIBEN el texto en la caja: el envío es siempre a mano. No lee ni guarda mensajes.
// Todo lo que dibuja va en elementos propios, fuera del árbol de WhatsApp, para no romperle nada.
(() => {
  if (window.top !== window || document.getElementById("ac-panel")) return;
  const CRM = "https://www.argencargo.com.ar";
  const EXT = chrome.runtime.getURL("").replace(/\/$/, "");
  const html = document.documentElement;
  const crear = (tag, props = {}, hijos = []) => { const e = document.createElement(tag); Object.assign(e, props); for (const h of hijos) e.append(h); return e; };

  // ── Lo que se dibuja ──
  const marco = crear("iframe", { title: "ARGENCARGO | CRM", src: chrome.runtime.getURL("panel.html") });
  const btnDiag = crear("button", { type: "button", textContent: "Diagnóstico", hidden: true });
  const btnCerrar = crear("button", { type: "button", className: "ac-x", textContent: "✕" });
  btnCerrar.setAttribute("aria-label", "Cerrar el panel del CRM");
  const panel = crear("div", { id: "ac-panel" }, [crear("div", { className: "ac-cab" }, [crear("span", {}, [crear("b", { textContent: "ARGENCARGO" }), " · CRM"]), crear("span", { className: "ac-esp" }), btnDiag, btnCerrar]), marco]);
  const tab = crear("button", { id: "ac-tab", type: "button", textContent: "CRM" });
  const tira = crear("div", { id: "ac-tira" });
  const rapidas = crear("div", { id: "ac-rapidas" });
  // Etiqueta al lado del nombre del chat (condición fiscal del cliente).
  const tag = crear("div", { id: "ac-tag" });
  document.body.append(panel, tab, tira, rapidas, tag);

  let origenes = [CRM];
  const abrir = (si) => { html.classList.toggle("ac-abierto", si); try { chrome.storage.local.set({ abierto: si }); } catch {} ubicar(); };
  btnCerrar.addEventListener("click", () => abrir(false));
  tab.addEventListener("click", () => abrir(true));
  try {
    chrome.storage.local.get(["abierto", "base"], (r) => {
      html.classList.toggle("ac-abierto", r?.abierto !== false);
      if (typeof r?.base === "string" && /^https?:\/\/[^/]+$/.test(r.base)) origenes = [CRM, r.base];
    });
  } catch { html.classList.add("ac-abierto"); }

  // ── Qué chat está abierto ──
  const RE_ID = /^(?:true|false)_([^_@]+)@(c\.us|lid|g\.us|newsletter|broadcast)_/;
  const pareceTel = (s) => /^\+?[\d\s\-().]{8,24}$/.test(s) && s.replace(/\D/g, "").length >= 10;
  const leerPantalla = () => {
    const main = document.querySelector("#main");
    if (!main) return null;
    const r = { tel: null, lid: null, nombre: null, grupo: false };
    const cab = main.querySelector("header");
    const t = cab && (cab.querySelector('span[dir="auto"]') || cab.querySelector("[title]"));
    const nombre = t ? (t.getAttribute("title") || t.textContent || "").trim().slice(0, 80) : "";
    if (nombre && pareceTel(nombre)) r.tel = nombre.replace(/\D/g, ""); else r.nombre = nombre || null;
    for (const n of main.querySelectorAll("[data-id]")) {
      const m = RE_ID.exec(n.getAttribute("data-id") || "");
      if (!m) continue;
      if (m[2] === "c.us") { if (/^\d{8,15}$/.test(m[1])) r.tel = m[1]; } else if (m[2] === "lid") r.lid = m[1]; else r.grupo = true;
      break;
    }
    return r;
  };
  // Lo que sabe la página (pagina.js), para los chats que no muestran el teléfono.
  const pedirActivo = () => new Promise((ok) => {
    let listo = false;
    const fin = (v) => { if (listo) return; listo = true; document.removeEventListener("ac-crm-activo", oir); ok(v); };
    const oir = (e) => { try { fin(JSON.parse(e.detail)); } catch { fin(null); } };
    document.addEventListener("ac-crm-activo", oir);
    document.dispatchEvent(new CustomEvent("ac-crm-pedir"));
    setTimeout(() => fin(null), 200);
  });

  let turno = 0, ultima = null, actual = { ac: "chat", id: 0, chat: null }, ultimoActivo = null, revisando = false, pendiente = false;
  const enviar = () => { try { marco.contentWindow?.postMessage(actual, EXT); } catch {} };
  const revisar = async () => {
    if (revisando) { pendiente = true; return; }
    revisando = true;
    try {
      const p = leerPantalla();
      let chat = null;
      if (p) {
        const a = await pedirActivo();
        ultimoActivo = a;
        chat = { ...p };
        if (a && !a.e) {
          if (a.grupo) chat.grupo = true;
          if (!chat.tel && a.tel) chat.tel = a.tel;
          if (!chat.lid && a.lid) chat.lid = a.lid;
          if (!chat.nombre && a.nombre) chat.nombre = a.nombre;
        }
      }
      const clave = chat ? JSON.stringify([chat.tel, chat.lid, chat.nombre, chat.grupo]) : "";
      if (clave !== ultima) {
        ultima = clave; turno += 1; actual = { ac: "chat", id: turno, chat };
        pintarTira(null); pintarRapidas([]); pintarTag(null);
        btnDiag.hidden = !(chat && !chat.grupo && !chat.tel);
        enviar();
      }
    } finally { revisando = false; if (pendiente) { pendiente = false; programar(); } }
  };
  let reloj = null;
  const programar = () => { clearTimeout(reloj); reloj = setTimeout(revisar, 250); };
  new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
  setInterval(revisar, 2000);

  // ── Tira y respuestas rápidas ──
  let hayTira = false, hayRapidas = false, hayTag = false;
  function pintarTag(t) {
    hayTag = !!(t && t.txt);
    tag.textContent = hayTag ? String(t.txt).slice(0, 30) : "";
    const c = hayTag && /^#[0-9a-fA-F]{6}$/.test(String(t.c || "")) ? t.c : "#b6c2d4";
    Object.assign(tag.style, { color: c, borderColor: `${c}88`, background: `${c}22` });
    ubicar();
  }
  function pintarTira(t) {
    tira.replaceChildren();
    // Un ítem con enlace (la cotización) se abre en el sistema, en otra pestaña. Solo enlaces a argencargo.com.ar.
    if (t?.items?.length) for (const it of t.items.slice(0, 4)) {
      const hijos = [crear("b", { textContent: String(it.b || "") }), " ", crear("span", { className: "ac-ok", textContent: String(it.ok || "") }), it.t ? ` · ${it.t}` : ""];
      const u = /^https:\/\/www\.argencargo\.com\.ar\//.test(String(it.u || "")) ? String(it.u) : "";
      tira.append(u ? crear("a", { href: u, target: "_blank", rel: "noopener" }, hijos) : crear("span", {}, hijos));
    }
    else if (t?.txt) tira.append(crear("span", { textContent: String(t.txt) }));
    if (t?.der) tira.append(crear("span", { className: "ac-der", textContent: String(t.der) }));
    hayTira = tira.childNodes.length > 0;
    ubicar();
  }
  function pintarRapidas(lista) {
    rapidas.replaceChildren();
    for (const r of (Array.isArray(lista) ? lista : []).slice(0, 8)) {
      if (!r?.l || !r?.t) continue;
      const b = crear("button", { type: "button", textContent: String(r.l) });
      b.addEventListener("click", () => escribir(String(r.t)));
      rapidas.append(b);
    }
    hayRapidas = rapidas.childNodes.length > 0;
    ubicar();
  }
  function ubicar() {
    const main = document.querySelector("#main");
    const cab = main?.querySelector("header"), pie = main?.querySelector("footer");
    const conTira = !!(hayTira && cab), conRapidas = !!(hayRapidas && pie);
    html.classList.toggle("ac-con-tira", conTira);
    html.classList.toggle("ac-con-rapidas", conRapidas);
    tira.style.display = conTira ? "flex" : "none";
    rapidas.style.display = conRapidas ? "flex" : "none";
    if (conTira) { const r = cab.getBoundingClientRect(); Object.assign(tira.style, { left: `${r.left}px`, top: `${r.bottom}px`, width: `${r.width}px` }); }
    // La etiqueta va pegada al final del nombre (se mide el texto, no su caja) y no pisa los botones de la derecha.
    let conTag = false;
    if (hayTag && cab) {
      const t = cab.querySelector('span[dir="auto"]') || cab.querySelector("[title]");
      if (t) {
        const rango = document.createRange(); rango.selectNodeContents(t);
        const rt = rango.getBoundingClientRect(), rc = cab.getBoundingClientRect(), caja = t.getBoundingClientRect();
        const izq = Math.min(rt.right, caja.right) + 10;
        if (rt.width > 0 && izq + 150 < rc.left + rc.width * 0.62) { conTag = true; Object.assign(tag.style, { left: `${izq}px`, top: `${rt.top + rt.height / 2}px` }); }
      }
    }
    tag.style.display = conTag ? "block" : "none";
    if (conRapidas) { const r = pie.getBoundingClientRect(); Object.assign(rapidas.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px` }); }
  }
  setInterval(ubicar, 300);
  window.addEventListener("resize", ubicar);

  // Escribe el texto en la caja de WhatsApp (no lo envía). Si no se puede, lo deja copiado.
  let relojAviso = null;
  const avisar = (txt) => { const a = crear("span", { className: "ac-aviso", textContent: txt }); rapidas.prepend(a); clearTimeout(relojAviso); relojAviso = setTimeout(() => a.remove(), 3500); };
  function escribir(texto) {
    const caja = document.querySelector('#main footer [contenteditable="true"]') || document.querySelector('#main [contenteditable="true"][role="textbox"]');
    let ok = false;
    if (caja) {
      const antes = caja.textContent || "";
      caja.focus();
      const sel = window.getSelection(), rango = document.createRange();
      rango.selectNodeContents(caja); rango.collapse(false); sel.removeAllRanges(); sel.addRange(rango);
      try { document.execCommand("insertText", false, texto); } catch {}
      ok = (caja.textContent || "") !== antes;
      if (!ok) {
        try { const dt = new DataTransfer(); dt.setData("text/plain", texto); caja.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); } catch {}
        ok = (caja.textContent || "") !== antes;
      }
    }
    if (!ok) navigator.clipboard?.writeText(texto).then(() => avisar("Copiado. Pegalo en el mensaje."), () => avisar("No se pudo escribir el mensaje."));
  }

  // ── Mensajes del puente y del CRM ──
  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || typeof d !== "object") return;
    if (e.origin === EXT && d.ac === "puente") { enviar(); return; }
    if (d.ac === "ficha" && origenes.includes(e.origin) && d.id === turno) { pintarTira(d.tira || null); pintarRapidas(d.rapidas || []); pintarTag(d.tag || null); }
  });

  // ── Diagnóstico: estructura de la pantalla, sin nombres, teléfonos ni mensajes ──
  const tapar = (s) => String(s || "").replace(/\d/g, "9").replace(/\p{L}/gu, "x").slice(0, 70);
  btnDiag.addEventListener("click", async () => {
    const main = document.querySelector("#main"), app = document.querySelector("#app");
    const ids = main ? [...main.querySelectorAll("[data-id]")] : [];
    const a = ultimoActivo;
    const d = {
      version: chrome.runtime.getManifest().version,
      app: !!app, anchoApp: app ? Math.round(app.getBoundingClientRect().width) : null, anchoVentana: window.innerWidth,
      main: !!main, cabecera: !!main?.querySelector("header"), pie: !!main?.querySelector("footer"),
      caja: !!document.querySelector('#main footer [contenteditable="true"]'),
      titulo: tapar(main?.querySelector('header span[dir="auto"]')?.textContent),
      dataIds: ids.length, muestras: ids.slice(0, 3).map((n) => tapar(n.getAttribute("data-id"))),
      pagina: a ? (a.e ? { error: a.e } : { servidor: a.servidor, lid: !!a.lid, tel: !!a.tel, grupo: !!a.grupo, nombre: !!a.nombre }) : null,
    };
    try { await navigator.clipboard.writeText(JSON.stringify(d, null, 1)); btnDiag.textContent = "Copiado"; } catch { btnDiag.textContent = "No se pudo copiar"; }
    setTimeout(() => { btnDiag.textContent = "Diagnóstico"; }, 2500);
  });

  revisar();
})();
