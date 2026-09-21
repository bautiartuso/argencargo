import { Proveedor, Marco } from "../kit";
import { CatalogoVista } from "../Tienda";
import { categorias, maquinas, ajustes } from "../_datos";
import { AM_URL } from "../_marca";
export const revalidate = 120;
export const metadata = { title: { absolute: "Catálogo de maquinaria — ARGENMAQ" }, description: "Máquinas de China con el precio final puesto en Argentina, por rubro: carpintería, gastronomía, metalúrgica, impresión, textil, construcción y más.", alternates: { canonical: `${AM_URL}/catalogo` } };
export default async function Catalogo() {
  const [{ arbol }, lista, aj] = await Promise.all([categorias(), maquinas(), ajustes()]);
  return <Proveedor><Marco actual="catalogo"><CatalogoVista arbol={arbol} lista={lista} diasVia={aj.dias_via} /></Marco></Proveedor>;
}
