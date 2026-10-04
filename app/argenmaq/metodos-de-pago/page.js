import Seccion from "../Seccion";
import { AM_URL } from "../_marca";
export const metadata = { title: { absolute: "Métodos de pago — ARGENMAQ" }, description: "Cómo pagar tu máquina en ARGENMAQ: dos cuotas de contado, por transferencia, efectivo o cripto.", alternates: { canonical: `${AM_URL}/metodos-de-pago` } };
export default function Pagina() { return <Seccion titulo="Métodos de pago" bajada="Pagás en dos cuotas: la primera al confirmar el pedido, que es el precio de la máquina, y la segunda cuando la máquina llega a Argentina, que es la importación. No es una financiación ni cuotas de tarjeta: cada cuota se paga de contado, por transferencia bancaria, en efectivo o con cripto." />; }
