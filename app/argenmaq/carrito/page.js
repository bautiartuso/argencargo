import { Proveedor, Marco } from "../kit";
import { CarritoVista } from "../Tienda";
import { ajustes } from "../_datos";
export const metadata = { title: { absolute: "Carrito — ARGENMAQ" }, robots: { index: false } };
export default async function Carrito() { const aj = await ajustes(); return <Proveedor><Marco actual="carrito"><CarritoVista diasVia={aj.dias_via} /></Marco></Proveedor>; }
