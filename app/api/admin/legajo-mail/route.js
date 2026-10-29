// POST /api/admin/legajo-mail {op_id, enviar?} — el mail con los papeles de la importación, a mano
// desde el Legajo de la op (29/10/2026). Sin "enviar" devuelve la vista previa (para, asunto, texto
// y qué va adjunto); con "enviar" lo manda por el Gmail conectado y lo marca en la op.
import { usuarioConRol } from "../../../../lib/auth-server";
import { armarMailLegajo, enviarMailLegajo, marcarMailLegajo } from "../../../../lib/legajo-mail";

export const maxDuration = 90;

export async function POST(req) {
  if (!(await usuarioConRol(req, ["admin"]))) return Response.json({ error: "Sin permiso" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(String(b.op_id || ""))) return Response.json({ error: "op_id inválido" }, { status: 400 });
  if (!b.enviar) {
    const m = await armarMailLegajo(b.op_id);
    if (m.omitir) return Response.json({ error: `No corresponde: ${m.omitir}` }, { status: 400 });
    return Response.json({ para: m.para, asunto: m.asunto, texto: m.texto, papeles: m.lineas });
  }
  const r = await enviarMailLegajo(b.op_id);
  if (r.omitir) return Response.json({ error: `No corresponde: ${r.omitir}` }, { status: 400 });
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  const cuando = new Date().toISOString();
  await marcarMailLegajo(b.op_id, cuando);
  return Response.json({ ok: true, para: r.para, enviado: cuando });
}
