// Términos y Condiciones de ARGENMAQ.
//
// ⚠️ Redactado sobre cómo opera ARGENMAQ hoy (anticipo de la máquina al confirmar,
// producción en fábrica, importación contra entrega). Las cláusulas de anticipo,
// garantía y límite de responsabilidad son decisiones comerciales: conviene que las
// revise un abogado antes de darlas por definitivas.
import DocArgenmaq, { AM_URL } from "../_marca";

export const metadata = {
  title: { absolute: "Términos y condiciones — ARGENMAQ" },
  description: "Términos y condiciones de compra e importación de maquinaria con ARGENMAQ.",
  alternates: { canonical: `${AM_URL}/terminos` },
};

const VIGENCIA = "20 de septiembre de 2026";

const SECCIONES = [
  {
    t: "1. Aceptación y alcance",
    p: [
      "Estos Términos y Condiciones (los “Términos”) regulan la relación entre ARGENMAQ y toda persona humana o jurídica (el “Usuario”) que solicite una cotización o compre maquinaria a través de este sitio o de sus canales de contacto.",
      "Solicitar un presupuesto, aceptarlo o abonar un anticipo implica la aceptación plena de estos Términos.",
    ],
  },
  {
    t: "2. Qué incluye el servicio",
    p: [
      "ARGENMAQ selecciona la máquina en fábrica, coordina su producción, controla la calidad antes del embarque y gestiona la importación y la entrega en Argentina a través de ARGENCARGO.",
      "El precio informado como “puesto en tu puerta” incluye la máquina, el flete internacional, los impuestos de importación y la entrega en la dirección declarada por el Usuario, salvo que el presupuesto indique expresamente otra cosa.",
      "No incluye, salvo mención expresa: obra civil, instalación eléctrica, puesta en marcha, capacitación, accesorios opcionales, ni maniobras especiales de descarga (grúa, montacargas, aperturas).",
    ],
  },
  {
    t: "3. Presupuesto y precio",
    p: [
      "Los precios publicados en el sitio son orientativos. El precio firme es el del presupuesto escrito, que tiene la vigencia allí indicada.",
      "Vencida esa vigencia, el precio puede recalcularse por variaciones del tipo de cambio, de las tarifas de flete, de los tributos de importación o del precio de fábrica.",
      "Salvo indicación en contrario, los valores se expresan en dólares estadounidenses.",
    ],
  },
  {
    t: "4. Forma de pago",
    destacado: true,
    p: [
      "El valor de la máquina se abona al confirmar el pedido: con ese pago la fábrica inicia la producción.",
      "El costo de importación se abona cuando la máquina llega a la Argentina, antes de la entrega.",
      "Confirmado el pedido y girado el pago a la fábrica, la cancelación por parte del Usuario habilita a ARGENMAQ a retener los costos ya incurridos (pago a fábrica, transporte contratado, comisiones bancarias y gastos de gestión).",
    ],
  },
  {
    t: "5. Plazos",
    p: [
      "Los plazos de producción y de tránsito informados son estimados. Pueden extenderse por causas ajenas a ARGENMAQ: demoras de fábrica, feriados en origen, disponibilidad de bodega, congestión portuaria, inspecciones aduaneras, medidas de fuerza o cambios normativos.",
      "Las demoras por estas causas no generan derecho a compensación ni habilitan la resolución del contrato, sin perjuicio del deber de ARGENMAQ de informar el estado de la operación.",
    ],
  },
  {
    t: "6. Especificaciones y compatibilidad",
    p: [
      "Las especificaciones técnicas (medidas, potencia, tensión, capacidad de producción) son las que informa el fabricante y se detallan en el presupuesto. El Usuario es responsable de verificar que la máquina sea apta para su uso, su espacio y su instalación eléctrica.",
      "Las máquinas se solicitan para 220 V / 50 Hz salvo que el presupuesto indique otra configuración. Las adaptaciones posteriores corren por cuenta del Usuario.",
      "Las imágenes del catálogo son ilustrativas: pueden existir diferencias estéticas menores respecto de la unidad entregada.",
    ],
  },
  {
    t: "7. Importación y tributos",
    p: [
      "La importación, el despacho aduanero y la entrega los realiza ARGENCARGO y se rigen además por sus Términos y Condiciones.",
      "Las retenciones, inspecciones o demoras dispuestas por la autoridad aduanera u otros organismos, por causas ajenas a ARGENMAQ, no eximen al Usuario del pago de los conceptos devengados. Los gastos que esas medidas generen (almacenaje, honorarios, multas) quedan a cargo de quien resulte responsable según su causa.",
    ],
  },
  {
    t: "8. Entrega y recepción",
    p: [
      "La entrega se realiza en la dirección declarada por el Usuario, que es responsable de su exactitud y de que el acceso permita el ingreso de la máquina.",
      "Al recibir, el Usuario debe verificar el estado del embalaje y de la unidad. Los daños visibles de transporte deben reclamarse en el momento de la entrega, con fotos, dejando constancia en el remito.",
      "Los faltantes o daños no visibles deben reclamarse dentro de los cinco (5) días corridos de recibida la máquina.",
    ],
  },
  {
    t: "9. Garantía",
    p: [
      "Las máquinas cuentan con la garantía del fabricante. El plazo y el alcance se informan en el presupuesto de cada máquina.",
      "ARGENMAQ gestiona la garantía frente a la fábrica: el Usuario hace el reclamo acá y no necesita tratar con el proveedor en origen.",
      "La garantía cubre defectos de fabricación. No cubre el desgaste normal, los consumibles, ni las fallas derivadas de mal uso, sobrecarga, instalación eléctrica deficiente, falta de mantenimiento o intervención de terceros no autorizados.",
      "Salvo que se acuerde por escrito, la garantía no incluye los costos de traslado de la máquina ni el envío de un técnico al domicilio del Usuario.",
    ],
  },
  {
    t: "10. Repuestos y posventa",
    p: [
      "ARGENMAQ puede gestionar la compra de repuestos a la misma fábrica. La disponibilidad y los plazos dependen del fabricante y se cotizan en cada caso.",
    ],
  },
  {
    t: "11. Limitación de responsabilidad",
    p: [
      "La responsabilidad de ARGENMAQ se limita al valor de la máquina involucrada.",
      "ARGENMAQ no responde por lucro cesante, pérdida de producción, pérdida de chance ni daños indirectos derivados de demoras, fallas o indisponibilidad de la máquina.",
    ],
  },
  {
    t: "12. Datos personales",
    p: ["El tratamiento de los datos personales del Usuario se rige por la Política de privacidad, que forma parte de estos Términos."],
  },
  {
    t: "13. Modificaciones",
    p: [
      "ARGENMAQ puede modificar estos Términos. La versión vigente es la publicada en esta página. Las operaciones en curso se rigen por la versión vigente al momento de aceptar el presupuesto.",
    ],
  },
  {
    t: "14. Ley aplicable y jurisdicción",
    p: [
      "Estos Términos se rigen por las leyes de la República Argentina. Para cualquier controversia, las partes se someten a los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.",
    ],
  },
];

export default function TerminosArgenmaq() {
  return <DocArgenmaq titulo="Términos y condiciones" bajada={`Última actualización: ${VIGENCIA}`} secciones={SECCIONES} actual="/terminos" />;
}
