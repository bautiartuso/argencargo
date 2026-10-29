// Liberación de envíos courier retenidos en la Aduana (29/10/2026). Página propia para buscadores
// ("envío retenido en aduana", "liberar envío courier", "paquete retenido DHL/FedEx"): no está en el
// menú; llega por Google, por el sitemap y desde la tarjeta de Servicios.
import Liberacion from "./Liberacion";
import { FAQ } from "./contenido";

const SITE = "https://www.argencargo.com.ar";
const URL = `${SITE}/liberacion-envios-courier-retenidos`;
const TITULO = "Liberación de envíos courier retenidos en la Aduana";
const DESC = "¿Tu envío de DHL, FedEx o UPS quedó retenido en la Aduana? Te ayudamos a liberarlo: vemos por qué se frenó, armamos la documentación y hacemos el trámite hasta que lo recibís.";

export const metadata = {
  title: TITULO,
  description: DESC,
  keywords: ["liberación de envíos courier", "envío retenido en aduana", "liberar envío retenido", "paquete retenido en aduana", "envío courier retenido", "DHL retenido aduana", "FedEx retenido aduana", "UPS retenido aduana", "documentación disponible para agente externo", "liberar paquete aduana Argentina"],
  alternates: { canonical: URL },
  openGraph: { title: `${TITULO} | Argencargo`, description: DESC, url: URL, siteName: "Argencargo", type: "website", locale: "es_AR" },
};

const LD = [
  {
    "@context": "https://schema.org", "@type": "Service",
    name: TITULO, serviceType: "Liberación de envíos courier retenidos en la Aduana", description: DESC, url: URL,
    areaServed: { "@type": "Country", name: "Argentina" },
    provider: { "@type": "Organization", name: "Argencargo", url: SITE, telephone: "+54 9 11 2508-8580", address: { "@type": "PostalAddress", streetAddress: "Virrey Loreto 2428", addressLocality: "Belgrano, CABA", addressCountry: "AR" } },
  },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: SITE },
    { "@type": "ListItem", position: 2, name: "Servicios", item: `${SITE}/servicios` },
    { "@type": "ListItem", position: 3, name: "Liberación de envíos retenidos", item: URL },
  ] },
];

export default function Page() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD) }} />
    <Liberacion />
  </>;
}
