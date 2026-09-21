import { Proveedor, Marco } from "../kit";
import { CuentaVista } from "../Tienda";
export const metadata = { title: { absolute: "Mi cuenta — ARGENMAQ" }, robots: { index: false } };
export default function Cuenta() { return <Proveedor><Marco actual="cuenta"><CuentaVista /></Marco></Proveedor>; }
