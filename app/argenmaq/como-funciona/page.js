import { Proveedor } from "../kit";
import ComoFunciona from "../ComoFunciona";
import { maquinas } from "../_datos";
import { AM_URL } from "../_marca";
export const revalidate = 600;
export const metadata = { title: { absolute: "Cómo funciona — ARGENMAQ" }, description: "Cómo comprar una máquina en ARGENMAQ paso a paso: qué incluye el precio, cómo se paga en dos cuotas, cuánto tarda y qué pasa en cada etapa hasta que la recibís.", alternates: { canonical: `${AM_URL}/como-funciona` } };
export default async function Como() {
  const lista = await maquinas();
  const fotos = lista.map((m) => (Array.isArray(m.fotos) && m.fotos[0]) || null).filter(Boolean).slice(0, 3);
  return <Proveedor><ComoFunciona fotos={fotos} /></Proveedor>;
}
