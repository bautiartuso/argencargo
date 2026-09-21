import { Proveedor, Marco } from "../../kit";
import { FichaVista } from "../../Tienda";
import { categorias, maquina, maquinas, ajustes } from "../../_datos";
import { AM_URL } from "../../_marca";
export const revalidate = 60;
export async function generateMetadata({ params }) { const m = await maquina(params.id); return m ? { title: { absolute: `${m.nombre} — ARGENMAQ` }, description: (m.descripcion || "").slice(0, 160), alternates: { canonical: `${AM_URL}/m/${m.id}` }, openGraph: { images: Array.isArray(m.fotos) && m.fotos[0] ? [m.fotos[0]] : [] } } : { title: { absolute: "Máquina — ARGENMAQ" } }; }
export default async function Ficha({ params }) {
  const [m, { cats, arbol }, aj] = await Promise.all([maquina(params.id), categorias(), ajustes()]);
  const relacionadas = m ? (await maquinas(`&categoria=eq.${encodeURIComponent(m.categoria || "")}&id=neq.${m.id}&limit=8`)) : [];
  return <Proveedor><Marco actual="catalogo" franja={arbol.filter((c) => c.slug !== "otros")}><FichaVista m={m} cats={cats} diasVia={aj.dias_via} relacionadas={relacionadas} /></Marco></Proveedor>;
}
