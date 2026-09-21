import { Proveedor, Marco } from "../kit";
import { ComoFunciona } from "../Tienda";
import { AM_URL } from "../_marca";
export const metadata = { title: { absolute: "Cómo funciona — ARGENMAQ" }, description: "Elegís la máquina, pagás el anticipo, la fábrica la produce, Argencargo la importa y la retirás o te la enviamos. Paso por paso.", alternates: { canonical: `${AM_URL}/como-funciona` } };
export default function Como() { return <Proveedor><Marco actual="como"><ComoFunciona /></Marco></Proveedor>; }
