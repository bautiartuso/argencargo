// Política de privacidad — Ley 25.326 (Protección de Datos Personales, Argentina).
import DocLegal from "../components/DocLegal";

export const metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos personales trata Argencargo, con qué finalidad, con quién los comparte y cómo ejercer los derechos de acceso, rectificación y supresión (Ley 25.326).",
  alternates: { canonical: "https://www.argencargo.com.ar/privacidad" },
};

const VIGENCIA = "15 de septiembre de 2026";

const SECCIONES = [
  {
    t: "1. Responsable del tratamiento",
    p: [
      "Argencargo, con domicilio en Virrey Loreto 2428, Belgrano, Ciudad Autónoma de Buenos Aires, es responsable del tratamiento de los datos personales que se recogen a través de argencargo.com.ar, del portal de clientes, del portal de agentes y de los canales de contacto (WhatsApp, correo electrónico).",
      "Contacto para cuestiones de privacidad: info@argencargo.com.ar.",
    ],
  },
  {
    t: "2. Qué datos tratamos",
    p: [
      "Datos de identificación y contacto: nombre y apellido o razón social, CUIT/CUIL, correo electrónico, teléfono, domicilio de entrega y datos de facturación.",
      "Datos de la operación: descripción de la mercadería, facturas y packing lists de proveedores, valores declarados, posiciones arancelarias, fotos de los bultos, comprobantes de pago y documentación aduanera.",
      "Datos técnicos: dirección IP, tipo de dispositivo y navegador, páginas visitadas y, si aceptaste las cookies de medición, el origen desde el que llegaste al sitio.",
      "No pedimos ni almacenamos datos sensibles en los términos del artículo 2 de la Ley 25.326.",
    ],
  },
  {
    t: "3. Para qué los usamos",
    p: [
      "Prestar el servicio contratado: cotizar, coordinar el transporte internacional, gestionar el despacho aduanero, emitir comprobantes y entregar la mercadería.",
      "Cumplir obligaciones legales, tributarias y aduaneras, incluida la información que deba presentarse ante ARCA/Aduana y otros organismos.",
      "Comunicarte el estado de tus operaciones por el portal, correo o WhatsApp.",
      "Mejorar el sitio y, con tu consentimiento, medir campañas publicitarias.",
    ],
  },
  {
    t: "4. Base legal",
    p: [
      "El tratamiento se apoya en la ejecución del contrato de servicios, en el cumplimiento de obligaciones legales y, para las cookies de medición y publicidad, en tu consentimiento, que podés dar o negar desde el aviso de cookies y revocar en cualquier momento.",
    ],
  },
  {
    t: "5. Con quién los compartimos",
    destacado: true,
    p: [
      "Con quienes son necesarios para que la carga llegue: despachantes de aduana, aerolíneas, navieras, agentes de carga en origen, depósitos fiscales y transportistas locales.",
      "Con organismos públicos cuando la normativa lo exige (Aduana, ARCA, otros organismos de control).",
      "Con proveedores tecnológicos que procesan datos por nuestra cuenta: Supabase (base de datos y almacenamiento), Vercel (hosting), Sentry (monitoreo de errores), Resend (envío de correos), Meta/WhatsApp Business (mensajería), Telegram (avisos internos) y proveedores de inteligencia artificial (Anthropic, OpenAI, fal.ai) que asisten en la lectura de facturas y en la clasificación arancelaria.",
      "No vendemos ni cedemos datos personales a terceros con fines comerciales ajenos al servicio.",
    ],
  },
  {
    t: "6. Transferencia internacional",
    p: [
      "Parte de esos proveedores aloja información en servidores fuera de la Argentina. Al contratar el servicio prestás consentimiento para esa transferencia, que se realiza con proveedores que ofrecen niveles adecuados de protección y sólo con el alcance necesario para prestar el servicio.",
    ],
  },
  {
    t: "7. Cuánto tiempo los conservamos",
    p: [
      "Conservamos los datos mientras exista relación comercial y, después, durante los plazos que exigen la normativa fiscal y aduanera y los plazos de prescripción de eventuales reclamos. Vencidos esos plazos, los datos se eliminan o se anonimizan.",
    ],
  },
  {
    t: "8. Cookies",
    p: [
      "Usamos cookies propias imprescindibles para mantener tu sesión iniciada en el portal y para recordar tus preferencias: sin ellas el sitio no funciona y no requieren consentimiento.",
      "Usamos además cookies de terceros de medición y publicidad (Google Analytics, Google Ads y Meta) que sólo se activan si las aceptás en el aviso de cookies. Si elegís “Solo esenciales”, esos scripts no se cargan.",
      "Podés cambiar tu decisión borrando los datos del sitio desde tu navegador: el aviso vuelve a aparecer en la próxima visita.",
    ],
  },
  {
    t: "9. Tus derechos",
    p: [
      "Podés solicitar el acceso, la rectificación, la actualización y la supresión de tus datos personales escribiendo a info@argencargo.com.ar. Vamos a responderte dentro de los plazos de la Ley 25.326 (10 días corridos para el acceso y 5 días hábiles para la rectificación o supresión).",
      "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso al mismo en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme el artículo 14, inciso 3 de la Ley 25.326.",
      "La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
    ],
  },
  {
    t: "10. Seguridad",
    p: [
      "Aplicamos medidas técnicas y organizativas para proteger la información: acceso restringido por roles, cifrado en tránsito (HTTPS), reglas de acceso a nivel de base de datos y registro de actividad. Ningún sistema es infalible, pero trabajamos para reducir el riesgo y responder rápido ante un incidente.",
    ],
  },
  {
    t: "11. Cambios",
    p: [
      "Podemos actualizar esta política. La versión vigente es siempre la publicada en esta página, con su fecha de última actualización.",
    ],
  },
];

export default function Privacidad() {
  return (
    <DocLegal
      titulo="Política de privacidad"
      bajada={`Última actualización: ${VIGENCIA}`}
      secciones={SECCIONES}
      actual="/privacidad"
    />
  );
}
