import { Proveedor } from "../kit";
import Repuestos from "../Repuestos";
import { AM_URL } from "../_marca";
export const metadata = { title: { absolute: "Repuestos — ARGENMAQ" }, description: "Te conseguimos el repuesto que estás buscando. Contanos qué necesitás y lo buscamos en fábrica: te pasamos precio final y tiempo de entrega.", alternates: { canonical: `${AM_URL}/repuestos` } };
export default function RepuestosPage() { return <Proveedor><Repuestos /></Proveedor>; }
