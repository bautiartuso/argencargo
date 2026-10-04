// Landing de ARGENMAQ (argenmaq.vercel.app/). Los datos vienen de las vistas públicas del catálogo.
import { Proveedor } from "./kit";
import Landing from "./Landing";
import { maquinas, ajustes } from "./_datos";

export const revalidate = 300;

// Las 10 de la portada: con foto, primero las que tienen video (se venden mejor) y después las más nuevas.
// Cuando haya ventas o visitas registradas, este orden pasa a ser "las más pedidas".
const portada = (lista) => lista
  .filter((m) => Array.isArray(m.fotos) && m.fotos.length > 0)
  .sort((a, b) => (b.video_url ? 1 : 0) - (a.video_url ? 1 : 0) || String(b.publicado_at || "").localeCompare(String(a.publicado_at || "")))
  .slice(0, 10);

export default async function ArgenmaqLanding() {
  const [lista, aj] = await Promise.all([maquinas(), ajustes()]);
  return <Proveedor><Landing destacadas={portada(lista)} total={lista.length} diasVia={aj.dias_via} /></Proveedor>;
}
