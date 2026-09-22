import { Proveedor } from "../kit";
import Nosotros from "../Nosotros";
import { operacionesArgencargo, maquinas, categorias } from "../_datos";
import { AM_URL } from "../_marca";
export const revalidate = 3600;
export const metadata = { title: { absolute: "Quiénes somos — ARGENMAQ" }, description: "ARGENMAQ importa maquinaria de fábricas en China y la entrega en Argentina con un precio final. Parte del grupo Argencargo.", alternates: { canonical: `${AM_URL}/quienes-somos` } };
export default async function Quienes() {
  const [ops, ms, { arbol }] = await Promise.all([operacionesArgencargo(), maquinas(), categorias()]);
  const stats = { ops, maquinas: ms.length, rubros: arbol.filter((c) => c.slug !== "otros").length };
  return <Proveedor><Nosotros stats={stats} /></Proveedor>;
}
