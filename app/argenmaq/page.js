// Landing de ARGENMAQ (argenmaq.vercel.app/). Los datos vienen de las vistas públicas del catálogo.
import { Proveedor } from "./kit";
import Landing from "./Landing";
import { categorias, maquinas, ajustes } from "./_datos";

export const revalidate = 300;

export default async function ArgenmaqLanding() {
  const [{ arbol }, lista, aj] = await Promise.all([categorias(), maquinas("&limit=12"), ajustes()]);
  return <Proveedor><Landing arbol={arbol.filter((c) => c.slug !== "otros")} destacadas={lista} diasVia={aj.dias_via} /></Proveedor>;
}
