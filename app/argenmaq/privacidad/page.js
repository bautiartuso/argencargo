// Política de privacidad de ARGENMAQ — Ley 25.326.
import DocArgenmaq, { AM_URL } from "../_marca";

export const metadata = {
  title: { absolute: "Política de privacidad — ARGENMAQ" },
  description: "Qué datos personales trata ARGENMAQ, con qué finalidad, con quién los comparte y cómo ejercer los derechos de acceso, rectificación y supresión.",
  alternates: { canonical: `${AM_URL}/privacidad` },
};

const VIGENCIA = "20 de septiembre de 2026";

const SECCIONES = [
  {
    t: "1. Responsable del tratamiento",
    p: [
      "ARGENMAQ, empresa del grupo ARGENCARGO, con domicilio en Virrey Loreto 2428, Belgrano, Ciudad Autónoma de Buenos Aires, es responsable del tratamiento de los datos personales que se recogen a través de este sitio y de los canales de contacto (WhatsApp, correo electrónico).",
      "Contacto para cuestiones de privacidad: info@argencargo.com.ar.",
    ],
  },
  {
    t: "2. Qué datos tratamos",
    p: [
      "Datos de identificación y contacto: nombre y apellido o razón social, CUIT, correo electrónico, teléfono y domicilio de entrega.",
      "Datos de la operación: máquina cotizada, especificaciones técnicas, presupuesto, comprobantes de pago y documentación necesaria para la importación y el despacho aduanero.",
      "Datos técnicos: dirección IP, dispositivo y navegador, páginas visitadas y, si aceptaste las cookies de medición, el origen desde el que llegaste al sitio.",
      "No pedimos ni almacenamos datos sensibles en los términos del artículo 2 de la Ley 25.326.",
    ],
  },
  {
    t: "3. Para qué los usamos",
    p: [
      "Cotizar la máquina, coordinar su producción en fábrica, importarla y entregarla.",
      "Cumplir obligaciones legales, tributarias y aduaneras.",
      "Informarte el estado de tu operación y gestionar la garantía.",
      "Mejorar el sitio y, con tu consentimiento, medir de dónde vienen las visitas.",
    ],
  },
  {
    t: "4. Base legal",
    p: [
      "El tratamiento se apoya en la ejecución del servicio contratado, en el cumplimiento de obligaciones legales y, para las cookies de medición, en tu consentimiento, que podés dar o negar en el aviso de cookies y revocar cuando quieras.",
    ],
  },
  {
    t: "5. Con quién los compartimos",
    destacado: true,
    p: [
      "Con ARGENCARGO, que realiza la importación, el despacho aduanero y la entrega.",
      "Con las fábricas y proveedores en origen, con el alcance necesario para fabricar y despachar la máquina.",
      "Con quienes intervienen en el transporte: agentes de carga, navieras, despachantes, depósitos y transportistas locales.",
      "Con organismos públicos cuando la normativa lo exige.",
      "Con proveedores tecnológicos que procesan datos por nuestra cuenta: Supabase (base de datos y archivos), Vercel (hosting) y Telegram (avisos internos del equipo).",
      "No vendemos ni cedemos datos personales a terceros con fines comerciales ajenos al servicio.",
    ],
  },
  {
    t: "6. Transferencia internacional",
    p: [
      "Parte de esa información se aloja o se comparte con proveedores y fábricas fuera de la Argentina. Al contratar el servicio prestás consentimiento para esa transferencia, que se hace sólo con el alcance necesario para prestarlo.",
    ],
  },
  {
    t: "7. Cuánto tiempo los conservamos",
    p: [
      "Mientras exista relación comercial y, después, durante los plazos que exigen la normativa fiscal y aduanera, los plazos de garantía de la maquinaria y los de prescripción de eventuales reclamos. Vencidos esos plazos, los datos se eliminan o se anonimizan.",
    ],
  },
  {
    t: "8. Cookies",
    p: [
      "Usamos cookies propias imprescindibles para que el sitio funcione y recuerde tus preferencias.",
      "Si aceptás, usamos además cookies de medición para entender cómo se usa el sitio. Si elegís “Solo esenciales”, esos scripts no se cargan.",
      "Podés cambiar tu decisión borrando los datos del sitio desde el navegador: el aviso vuelve a aparecer en la próxima visita.",
    ],
  },
  {
    t: "9. Tus derechos",
    p: [
      "Podés pedir el acceso, la rectificación, la actualización y la supresión de tus datos personales escribiendo a info@argencargo.com.ar. Respondemos dentro de los plazos de la Ley 25.326 (10 días corridos para el acceso y 5 días hábiles para la rectificación o supresión).",
      "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso al mismo en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto, conforme el artículo 14, inciso 3 de la Ley 25.326.",
      "La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
    ],
  },
  {
    t: "10. Seguridad",
    p: [
      "Aplicamos medidas técnicas y organizativas para proteger la información: acceso por roles, cifrado en tránsito (HTTPS) y reglas de acceso a nivel de base de datos. Ningún sistema es infalible, pero trabajamos para reducir el riesgo y reaccionar rápido ante un incidente.",
    ],
  },
  { t: "11. Cambios", p: ["Podemos actualizar esta política. La versión vigente es siempre la publicada acá, con su fecha de última actualización."] },
];

export default function PrivacidadArgenmaq() {
  return <DocArgenmaq titulo="Política de privacidad" bajada={`Última actualización: ${VIGENCIA}`} secciones={SECCIONES} actual="/privacidad" />;
}
