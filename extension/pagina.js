// Corre en la página de WhatsApp Web. Solo LEE cuál es el chat abierto (identificador, teléfono y
// nombre) de los datos que la página ya tiene en memoria, para los chats que no muestran el teléfono
// en pantalla. No lee mensajes, no envía nada y no cambia nada. Si WhatsApp cambia por dentro,
// devuelve null y la extensión sigue con lo que se ve en pantalla.
(() => {
  const pedir = (n) => { try { return window.require ? window.require(n) : null; } catch { return null; } };
  const usuario = (w) => { if (!w) return null; const u = typeof w === "string" ? w.split("@")[0] : w.user; return /^\d{8,15}$/.test(String(u || "")) ? String(u) : null; };
  const telDeLid = (chat, id) => {
    const c = chat.contact;
    let t = usuario(c && c.phoneNumber);
    if (t) return t;
    const pruebas = [
      () => pedir("WAWebApiContact").getPhoneNumber(id),
      () => pedir("WAWebLidMigrationUtils").toPn(id),
      () => pedir("WAWebLidPnCache").getPhoneNumber(id),
    ];
    for (const p of pruebas) { try { t = usuario(p()); if (t) return t; } catch {} }
    return null;
  };
  const activo = () => {
    try {
      const col = (pedir("WAWebChatCollection") || {}).ChatCollection || (pedir("WAWebCollections") || {}).Chat;
      if (!window.require) return { e: "sin require" };
      if (!col) return { e: "sin coleccion" };
      const chat = (col.getActive && col.getActive()) || (col.getModelsArray ? col.getModelsArray().find((x) => x.active) : null);
      if (!chat || !chat.id) return { e: "sin chat activo" };
      const id = chat.id;
      const servidor = id.server || "";
      const grupo = servidor === "g.us" || servidor === "newsletter" || servidor === "broadcast" || !!chat.isGroup;
      const c = chat.contact || {};
      return {
        servidor,
        lid: servidor === "lid" ? String(id.user || "") : null,
        tel: grupo ? null : servidor === "c.us" ? usuario(id) : servidor === "lid" ? telDeLid(chat, id) : null,
        grupo,
        nombre: String(c.name || chat.formattedTitle || chat.name || c.pushname || "").slice(0, 80) || null,
      };
    } catch (err) { return { e: String((err && err.message) || err).slice(0, 80) }; }
  };
  document.addEventListener("ac-crm-pedir", () => {
    let r = null;
    try { r = activo(); } catch {}
    document.dispatchEvent(new CustomEvent("ac-crm-activo", { detail: JSON.stringify(r) }));
  });
})();
