import Seccion from "../Seccion";
import { AM_URL } from "../_marca";
export const metadata = { title: { absolute: "Métodos de pago — ARGENMAQ" }, description: "Cómo pagar tu máquina en ARGENMAQ: anticipo y saldo, transferencia, efectivo y cripto.", alternates: { canonical: `${AM_URL}/metodos-de-pago` } };
export default function Pagina() { return <Seccion titulo="Métodos de pago" bajada="Se paga en dos veces: el anticipo al confirmar el pedido y el saldo cuando la máquina llega a Argentina. Por ahora aceptamos transferencia bancaria, efectivo y cripto; sin tarjeta ni cuotas." />; }
