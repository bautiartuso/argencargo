// Aviso legal de ARGENMAQ. Se sirve en argenmaq.<dominio>/legal (rewrite del middleware).
import DocArgenmaq, { AM_URL } from "../_marca";

export const metadata = {
  title: { absolute: "Aviso legal — ARGENMAQ" },
  description: "Datos identificatorios de ARGENMAQ y condiciones de uso del sitio.",
  alternates: { canonical: `${AM_URL}/legal` },
};

// ⚠️ COMPLETAR: razón social y CUIT. Las filas vacías no se renderizan, así que la
// página no inventa datos, pero el aviso legal queda incompleto hasta cargarlos.
const DATOS = {
  razonSocial: "",
  cuit: "",
  nombreComercial: "ARGENMAQ",
  grupo: "Empresa del grupo ARGENCARGO",
  domicilio: "Virrey Loreto 2428, Belgrano, Ciudad Autónoma de Buenos Aires, Argentina",
  whatsapp: "+54 9 11 2508-8580",
  actividad: "Venta e importación de maquinaria industrial: selección de fábrica en origen, control de calidad, importación y entrega en Argentina.",
};

const FILAS = [
  ["Razón social", DATOS.razonSocial],
  ["CUIT", DATOS.cuit],
  ["Nombre comercial", DATOS.nombreComercial],
  ["Grupo", DATOS.grupo],
  ["Domicilio", DATOS.domicilio],
  ["WhatsApp", DATOS.whatsapp],
  ["Actividad", DATOS.actividad],
].filter(([, v]) => v);

const SECCIONES = [
  { t: "1. Titular del sitio", p: ["Este sitio es operado por:"], filas: FILAS },
  {
    t: "2. Objeto del sitio",
    p: [
      "El sitio presenta el catálogo de maquinaria de ARGENMAQ y los pasos para comprarla puesta en Argentina.",
      "Los precios y plazos publicados son orientativos: dependen del tipo de cambio, de las tarifas de flete y de la disponibilidad en fábrica al momento de confirmar. El valor final se confirma por escrito en el presupuesto antes de iniciar la operación.",
    ],
  },
  {
    t: "3. Relación con ARGENCARGO",
    p: [
      "ARGENMAQ es una unidad del grupo ARGENCARGO. La importación, el despacho aduanero y la entrega de las máquinas los realiza ARGENCARGO, y se rigen además por sus propios Términos y Condiciones.",
    ],
  },
  {
    t: "4. Condiciones de uso",
    p: [
      "El uso del sitio implica la aceptación de este aviso y de los Términos y Condiciones.",
      "El Usuario se compromete a no usar el sitio con fines ilícitos, a no intentar acceder a áreas restringidas y a no interferir con su funcionamiento.",
    ],
  },
  {
    t: "5. Propiedad intelectual",
    p: [
      "La marca ARGENMAQ, su logotipo, los textos, las fichas de producto, el diseño y el software del sitio son propiedad del grupo o se usan con licencia. Las marcas de los fabricantes pertenecen a sus titulares. No está permitida su reproducción sin autorización previa por escrito.",
    ],
  },
  {
    t: "6. Contacto",
    p: ["Cualquier consulta sobre este aviso legal puede hacerse por WhatsApp al número indicado más arriba."],
  },
];

export default function AvisoLegalArgenmaq() {
  return <DocArgenmaq titulo="Aviso legal" bajada="Identificación del titular del sitio y condiciones de uso." secciones={SECCIONES} actual="/legal" />;
}
