import Seccion from "../Seccion";
import { AM_URL } from "../_marca";
export const metadata = { title: { absolute: "Soporte — ARGENMAQ" }, description: "Soporte de ARGENMAQ: seguimiento de la importación y contacto directo.", alternates: { canonical: `${AM_URL}/soporte` } };
export default function Pagina() { return <Seccion titulo="Soporte" bajada="Cada hito de la importación te llega por mail y lo seguís desde tu cuenta. Si algo no está claro, hablás directo con la persona que sigue tu operación." />; }
