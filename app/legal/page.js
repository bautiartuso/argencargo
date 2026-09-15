// Aviso legal — identificación de la empresa detrás del sitio.
import DocLegal from "../components/DocLegal";

export const metadata = {
  title: "Aviso legal",
  description: "Datos identificatorios de Argencargo, titular del sitio argencargo.com.ar, y condiciones de uso del sitio.",
  alternates: { canonical: "https://www.argencargo.com.ar/legal" },
};

// ⚠️ COMPLETAR: razón social y CUIT reales. Las filas vacías no se muestran, así que
// mientras estén en "" la página sale sin datos inventados, pero el aviso legal queda
// incompleto hasta cargarlos.
const DATOS = {
  razonSocial: "",
  cuit: "",
  nombreComercial: "Argencargo",
  domicilio: "Virrey Loreto 2428, Belgrano, Ciudad Autónoma de Buenos Aires, Argentina",
  email: "info@argencargo.com.ar",
  telefono: "+54 9 11 2508-8580",
  actividad: "Servicios de logística internacional, courier, transporte de carga aérea y marítima y gestión de importaciones.",
};

const FILAS = [
  ["Razón social", DATOS.razonSocial],
  ["CUIT", DATOS.cuit],
  ["Nombre comercial", DATOS.nombreComercial],
  ["Domicilio", DATOS.domicilio],
  ["Correo electrónico", DATOS.email],
  ["Teléfono / WhatsApp", DATOS.telefono],
  ["Actividad", DATOS.actividad],
].filter(([, v]) => v);

const SECCIONES = [
  {
    t: "1. Titular del sitio",
    p: ["El sitio web argencargo.com.ar y sus subdominios son operados por:"],
    filas: FILAS,
  },
  {
    t: "2. Objeto del sitio",
    p: [
      "Este sitio informa sobre los servicios de Argencargo y da acceso al portal de clientes, a la calculadora de costos de importación y al seguimiento de cargas.",
      "Las cotizaciones, simulaciones y estimaciones que se obtienen en el sitio son orientativas y no constituyen una oferta contractual. El valor definitivo de una operación se confirma por escrito antes de iniciarla.",
    ],
  },
  {
    t: "3. Condiciones de uso",
    p: [
      "El uso del sitio implica la aceptación de estos avisos y de los Términos y Condiciones del servicio.",
      "El Usuario se compromete a no utilizar el sitio con fines ilícitos, a no intentar acceder a áreas restringidas ni a interferir con su funcionamiento normal.",
    ],
  },
  {
    t: "4. Propiedad intelectual",
    p: [
      "La marca Argencargo, el logotipo, los textos, el diseño y el software del sitio son propiedad de Argencargo o se utilizan con licencia. No está permitida su reproducción sin autorización previa por escrito.",
    ],
  },
  {
    t: "5. Enlaces a terceros",
    p: [
      "El sitio puede contener enlaces a servicios de terceros (WhatsApp, Instagram, transportistas, organismos oficiales). Argencargo no controla esos sitios ni responde por sus contenidos o políticas.",
    ],
  },
  {
    t: "6. Contacto",
    p: [
      "Cualquier consulta sobre este aviso legal puede dirigirse a info@argencargo.com.ar o al domicilio indicado más arriba.",
    ],
  },
];

export default function AvisoLegal() {
  return (
    <DocLegal
      titulo="Aviso legal"
      bajada="Identificación del titular del sitio y condiciones de uso."
      secciones={SECCIONES}
      actual="/legal"
    />
  );
}
