// Página de Servicios (04/10/2026): flete aéreo, flete marítimo, gestión de pagos internacionales y
// liberación de envíos retenidos. Página propia para que Google la muestre como link debajo del resultado.
import Servicios from "./Servicios";

const SITE = "https://www.argencargo.com.ar";
const TITULO = "Servicios: flete aéreo, flete marítimo, pagos internacionales y envíos retenidos";
const DESC = "Flete aéreo y marítimo a Argentina, gestión de pagos internacionales a tus proveedores y liberación de envíos retenidos en la aduana.";

export const metadata = {
  title: TITULO,
  description: DESC,
  alternates: { canonical: `${SITE}/servicios` },
  openGraph: { title: `${TITULO} | Argencargo`, description: DESC, url: `${SITE}/servicios`, siteName: "Argencargo", type: "website", locale: "es_AR" },
};

export default function Page() {
  return <Servicios />;
}
