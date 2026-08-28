// Términos y Condiciones — página pública. Base: modelo estándar de couriers AR,
// reforzando devengamiento del flete, retenciones aduaneras, abandono de carga y
// derecho de retención (los puntos donde el negocio necesita estar cubierto).
const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";
const BG = "#0a1223";
const GOLD = "#E8C99B";

export const metadata = {
  title: "Términos y Condiciones — Argencargo",
  description: "Términos y condiciones del servicio de importación y logística internacional de Argencargo.",
};

const VIGENCIA = "28 de agosto de 2026";

const SECCIONES = [
  {
    t: "1. Aceptación y alcance",
    p: [
      "Los presentes Términos y Condiciones (los “Términos”) regulan la relación entre ARGENCARGO (en adelante, “ARGENCARGO”) y toda persona humana o jurídica (el “Usuario”) que utilice cualquiera de sus servicios: courier aéreo, carga marítima (LCL/FCL), gestión integral de importación, cotizaciones, depósitos en origen y cualquier servicio conexo.",
      "La creación de una cuenta, la solicitud de una cotización, la entrega de mercadería en cualquiera de los depósitos de origen o la contratación de un servicio implican la aceptación plena de estos Términos.",
    ],
  },
  {
    t: "2. Descripción del servicio",
    p: [
      "ARGENCARGO recibe bienes en depósitos ubicados en el exterior (China y otros orígenes habilitados) para consolidarlos y transportarlos a la República Argentina, gestionando el proceso logístico y, cuando corresponda, el proceso aduanero.",
      "Los plazos de tránsito informados son siempre estimados. Pueden extenderse por motivos ajenos a ARGENCARGO (demoras de aerolíneas o navieras, inspecciones, feriados, congestión portuaria, medidas de fuerza, cambios normativos), sin que esto genere responsabilidad para la empresa ni derecho a compensación.",
    ],
  },
  {
    t: "3. Declaraciones del Usuario",
    p: [
      "Toda la información aportada por el Usuario sobre su carga (contenido, cantidad, valor, marca, condición tributaria y datos personales) reviste carácter de declaración jurada. El Usuario garantiza su exactitud y exime a ARGENCARGO de cualquier responsabilidad derivada de datos erróneos, incompletos o falsos.",
      "El Usuario autoriza a ARGENCARGO y a las autoridades aduaneras (nacionales o internacionales) a inspeccionar su carga si así lo requirieran.",
      "Las diferencias entre lo declarado y lo verificado (valor, cantidad, naturaleza de la mercadería, marcas) y sus consecuencias (multas, cargos, demoras, decomisos) son exclusiva responsabilidad del Usuario.",
    ],
  },
  {
    t: "4. Mercadería prohibida y restringida",
    p: [
      "Está prohibido el envío de: dinero en efectivo o títulos valores, armas y municiones, estupefacientes, materiales peligrosos, inflamables o explosivos, mercadería falsificada, productos perecederos, animales o plantas, y todo bien cuya importación esté prohibida por la normativa argentina.",
      "Los productos sujetos a intervenciones de terceros organismos (ANMAT, SENASA, u otros) sólo se aceptan con conocimiento y coordinación previa. ARGENCARGO puede rechazar cualquier carga que a su criterio implique un riesgo legal u operativo.",
      "El envío de artículos prohibidos o restringidos sin declaración es responsabilidad exclusiva del Usuario, quien deberá afrontar la totalidad de multas, gastos y perjuicios que se generen, incluso frente a terceros.",
    ],
  },
  {
    t: "5. Gestión aduanera",
    p: [
      "ARGENCARGO realiza las gestiones aduaneras correspondientes para las cargas correctamente declaradas, en los regímenes que correspondan según el canal contratado.",
      "ARGENCARGO no responde por modificaciones en la normativa aduanera, tributaria o cambiaria, ni por decisiones de la autoridad aduanera u otros organismos estatales que alteren costos, plazos o la viabilidad de una importación.",
    ],
  },
  {
    t: "6. Retenciones aduaneras",
    destacado: true,
    p: [
      "El flete internacional, el seguro y los cargos de gestión se devengan con el despacho de la carga desde el país de origen y son exigibles con independencia del resultado del proceso aduanero. La retención, demora, inspección, rechazo o decomiso de la carga por parte de la autoridad aduanera u otros organismos, por causas ajenas a la responsabilidad de ARGENCARGO, no exime al Usuario del pago de dichos conceptos.",
      "Si la carga es retenida por circunstancias ajenas a la responsabilidad de ARGENCARGO, el Usuario podrá optar por realizar la desaduanización con su propio despachante o solicitar los servicios de ARGENCARGO, asumiendo en ambos casos los costos devengados y los gastos adicionales que la retención genere (almacenaje fiscal, honorarios, multas, gestiones de re-despacho o destrucción).",
      "Los costos y demoras derivados de retenciones atribuibles a la declaración del Usuario (valor, contenido, marcas, documentación faltante) son íntegramente a su cargo.",
    ],
  },
  {
    t: "7. Abandono de la carga",
    destacado: true,
    p: [
      "Se considera abandono tanto la manifestación expresa del Usuario como la falta de retiro, de instrucciones o de pago dentro de los 60 días corridos desde que la carga está disponible para su entrega o desde que se le requirió una decisión sobre una carga retenida.",
      "El abandono de la carga NO extingue las obligaciones de pago ya devengadas (flete, seguro, cargos de gestión, almacenaje, multas y gastos aduaneros). El Usuario continúa obligado a abonarlas, y el saldo impago quedará registrado como deuda en su cuenta corriente, pudiendo ARGENCARGO exigir su cancelación antes de entregar cualquier otra carga del mismo Usuario.",
      "Producido el abandono, ARGENCARGO podrá disponer de la mercadería (destrucción, donación o venta) sin derecho a compensación alguna para el Usuario. Si la mercadería fuera vendida, el producido se imputará primero a los saldos impagos del Usuario y a los gastos de disposición.",
    ],
  },
  {
    t: "8. Derecho de retención y compensación",
    destacado: true,
    p: [
      "ARGENCARGO podrá retener la entrega de cualquier carga del Usuario hasta la cancelación total de los saldos vencidos de su cuenta, cualquiera sea la operación que los haya originado.",
      "El Usuario autoriza a ARGENCARGO a compensar saldos entre sus operaciones: los créditos a favor del Usuario podrán aplicarse a deudas pendientes, y las deudas de operaciones anteriores podrán trasladarse al saldo a abonar de operaciones en curso.",
    ],
  },
  {
    t: "9. Tarifas y pagos",
    p: [
      "En los servicios aéreos, el costo del flete se calcula sobre el peso real o el peso volumétrico por bulto, aplicándose el que resulte mayor. En los servicios marítimos, sobre el volumen (m³) o según lo cotizado. Las tarifas vigentes son las informadas al momento de cotizar o despachar cada carga.",
      "El Usuario debe abonar todos los cargos del servicio: flete, seguro, gestión, impuestos, tasas y derechos aduaneros que correspondan, pudiendo ARGENCARGO requerir su pago total o parcial en forma anticipada.",
      "Los pagos en pesos argentinos se convierten al tipo de cambio informado por ARGENCARGO al día del pago. Los saldos impagos luego de la entrega o del vencimiento comunicado devengan la posibilidad de retención descripta en la sección 8.",
    ],
  },
  {
    t: "10. Entregas y retiros",
    p: [
      "Una vez que la carga está lista, el Usuario debe coordinar su retiro o entrega a través de los canales dispuestos por ARGENCARGO. La mercadería no retirada dentro de los plazos comunicados puede generar cargos de almacenaje.",
      "Transcurridos 60 días corridos desde la disponibilidad de la carga sin retiro por motivos imputables al Usuario, resulta aplicable el régimen de abandono de la sección 7.",
      "En envíos por transportista de terceros (Via Cargo, Andreani u otros), la responsabilidad de ARGENCARGO cesa con la entrega de la carga al transportista. Los reclamos por el tramo posterior se rigen por las condiciones del transportista.",
    ],
  },
  {
    t: "11. Reclamos",
    p: [
      "Todo reclamo por faltantes, daños o diferencias debe presentarse dentro de los 30 días corridos posteriores al momento en que la carga esté disponible para ser entregada, acompañando la evidencia correspondiente (fotos, packing list, comprobantes). Vencido ese plazo, la carga se considera entregada de conformidad.",
    ],
  },
  {
    t: "12. Limitación de responsabilidad",
    p: [
      "ARGENCARGO no responde por daños previos de los paquetes recibidos en los depósitos de origen, ni por deficiencias, fallas de fábrica o falta de utilidad de los bienes transportados, cuya relación es exclusiva entre el Usuario y su proveedor.",
      "La responsabilidad máxima de ARGENCARGO por pérdida o daño imputable a su operación se limita a USD 100 por envío o USD 20 por kilogramo afectado, el que resulte mayor, salvo contratación de seguro adicional con cobertura superior.",
      "Se excluye la responsabilidad por causas de fuerza mayor: desastres naturales, guerras, huelgas, conmoción civil, paros aduaneros, de aerolíneas o portuarios, y hechos del príncipe. No se reconocen reclamos por lucro cesante ni daños indirectos.",
      "ARGENCARGO tampoco responde cuando el daño derive de declaración incorrecta de la carga, embalaje deficiente de origen o envío de artículos prohibidos o restringidos.",
    ],
  },
  {
    t: "13. Plataforma",
    p: [
      "ARGENCARGO no garantiza el acceso ininterrumpido a su sitio web ni a sus portales, y no responde por daños derivados de fallas técnicas, interrupciones o transmisiones erróneas de datos.",
    ],
  },
  {
    t: "14. Datos personales",
    p: [
      "El Usuario presta su consentimiento para el tratamiento de sus datos personales exclusivamente a los fines de la prestación del servicio, conforme a la Ley N° 25.326 de Protección de Datos Personales. El titular de los datos puede ejercer los derechos de acceso, rectificación y supresión escribiendo a info@argencargo.com.ar.",
    ],
  },
  {
    t: "15. Propiedad intelectual",
    p: [
      "Los contenidos del sitio y de los portales (marcas, logos, textos, desarrollos) son propiedad exclusiva de ARGENCARGO. Queda prohibida su copia, distribución o uso con fines comerciales sin autorización expresa.",
    ],
  },
  {
    t: "16. Modificaciones",
    p: [
      "ARGENCARGO puede modificar estos Términos en cualquier momento. Las modificaciones rigen desde su publicación en esta página para las cargas despachadas con posterioridad. La versión vigente es siempre la publicada en www.argencargo.com.ar/terminos.",
    ],
  },
  {
    t: "17. Ley aplicable y jurisdicción",
    p: [
      "Estos Términos se rigen por las leyes de la República Argentina. Toda controversia se somete a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, con renuncia a cualquier otro fuero.",
    ],
  },
];

export default function Terminos() {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "36px 22px 70px" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 26 }}>
          <img src={LOGO} alt="Argencargo" style={{ height: 34 }} />
        </a>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Términos y Condiciones</h1>
        <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", margin: "0 0 30px" }}>Última actualización: {VIGENCIA}</p>

        {SECCIONES.map((s, i) => (
          <section key={i} style={{
            marginBottom: 18,
            padding: s.destacado ? "16px 18px" : "0 0 4px",
            borderRadius: s.destacado ? 12 : 0,
            background: s.destacado ? "rgba(232,201,155,0.05)" : "transparent",
            border: s.destacado ? "1px solid rgba(232,201,155,0.22)" : "none",
          }}>
            <h2 style={{ fontSize: 15.5, fontWeight: 800, color: s.destacado ? GOLD : "#fff", margin: "0 0 8px", letterSpacing: "-0.005em" }}>{s.t}</h2>
            {s.p.map((tx, k) => (
              <p key={k} style={{ fontSize: 13.5, lineHeight: 1.65, color: "rgba(255,255,255,0.72)", margin: "0 0 9px" }}>{tx}</p>
            ))}
          </section>
        ))}

        <div style={{ marginTop: 34, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>© 2026 Argencargo</span>
          <a href="mailto:info@argencargo.com.ar" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>info@argencargo.com.ar</a>
        </div>
      </div>
    </div>
  );
}
