import { Proveedor, Marco } from "../kit";
import { QuienesSomos } from "../Tienda";
import { operacionesArgencargo } from "../_datos";
import { AM_URL } from "../_marca";
export const revalidate = 3600;
export const metadata = { title: { absolute: "Quiénes somos — ARGENMAQ" }, description: "ARGENMAQ es la unidad de maquinaria del grupo Argencargo: importación de máquinas de China con precio final puesto en Argentina.", alternates: { canonical: `${AM_URL}/quienes-somos` } };
export default async function Quienes() { const ops = await operacionesArgencargo(); return <Proveedor><Marco actual="quienes"><QuienesSomos ops={ops} /></Marco></Proveedor>; }
