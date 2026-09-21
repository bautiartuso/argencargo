// Landing de ARGENMAQ. Copia la estructura de b2box.pro (barra de grupo arriba que desaparece
// al scrollear, nav fija, tipografía enorme, pasos, grilla "bento" con mini animaciones), con
// contenido propio. Tipografía y colores provisorios hasta que Bautista los cierre.
import Landing from "./Landing";
import { AM_URL } from "./_marca";

export const revalidate = 300;
export const metadata = {
  title: { absolute: "ARGENMAQ — Maquinaria de China, puesta en tu puerta" },
  description: "Elegís la máquina, ves el precio final con flete e impuestos en Argentina, y nosotros hacemos todo lo demás: fábrica, control, importación y entrega. Una empresa del grupo Argencargo.",
};

// ARGENMAQ es una unidad del grupo: se declara como Organization propia y se la relaciona
// con Argencargo por parentOrganization, que es lo que Google entiende.
const LD_ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": ["Organization", "LocalBusiness"],
  "@id": `${AM_URL}/#organization`,
  name: "ARGENMAQ",
  url: AM_URL,
  description: "Venta e importación de maquinaria industrial desde China, con precio final puesto en Argentina: fábrica, control de calidad, importación y entrega.",
  telephone: "+54-9-11-2508-8580",
  address: { "@type": "PostalAddress", streetAddress: "Virrey Loreto 2428", addressLocality: "Belgrano", addressRegion: "CABA", addressCountry: "AR" },
  areaServed: { "@type": "Country", name: "Argentina" },
  parentOrganization: { "@type": "Organization", name: "Argencargo", url: "https://www.argencargo.com.ar" },
  sameAs: ["https://wa.me/5491125088580"],
};

const LD_WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${AM_URL}/#website`,
  url: AM_URL,
  name: "ARGENMAQ",
  inLanguage: "es-AR",
  publisher: { "@id": `${AM_URL}/#organization` },
};

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZnNsdml4aGxiaXlmbWVkbWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzM5NjEsImV4cCI6MjA5MTQwOTk2MX0.5TDSTpaPBHDGc2ML5u-UT3ct8_a4rwy6SSEQkbJy3cY";

export default async function ArgenmaqLanding() {
  let cats = [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/cat_categorias?select=slug,nombre,padre_slug,orden&order=orden.asc`, { headers: { apikey: SB_KEY }, next: { revalidate: 300 } });
    const d = await r.json();
    if (Array.isArray(d)) cats = d;
  } catch {}
  const rubros = cats.filter((c) => !c.padre_slug && c.slug !== "otros").map((c) => ({ ...c, subs: cats.filter((s) => s.padre_slug === c.slug).map((s) => s.nombre) }));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD_ORGANIZATION) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD_WEBSITE) }} />
      <Landing rubros={rubros} />
    </>
  );
}
