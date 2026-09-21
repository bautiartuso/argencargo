import { Proveedor, Marco } from "../../kit";
import { CatalogoVista } from "../../Tienda";
import { categorias, maquinas, ajustes } from "../../_datos";
import { AM_URL } from "../../_marca";
export const revalidate = 120;
export async function generateMetadata({ params }) { const { arbol } = await categorias(); const c = arbol.find((x) => x.slug === params.cat); return { title: { absolute: `${c ? c.nombre : "Catálogo"} — ARGENMAQ` }, alternates: { canonical: `${AM_URL}/catalogo/${params.cat}` } }; }
export default async function CatalogoRubro({ params }) {
  const [{ arbol }, lista, aj] = await Promise.all([categorias(), maquinas(`&categoria=eq.${encodeURIComponent(params.cat)}`), ajustes()]);
  return <Proveedor><Marco actual="catalogo"><CatalogoVista arbol={arbol} lista={lista} diasVia={aj.dias_via} rubro={params.cat} /></Marco></Proveedor>;
}
