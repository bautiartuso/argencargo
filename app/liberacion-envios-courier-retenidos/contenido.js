// Textos de la página de liberación de envíos courier retenidos (29/10/2026). Los usa la página (lo que
// se ve) y page.js (los datos estructurados de Google: servicio, preguntas frecuentes y migas).
export const WA = "5491125088580";
export const WA_MSG = "Hola! Tengo un envío courier retenido en la Aduana y quiero liberarlo. Te paso el tracking:";

export const CAUSAS = [
  { t: "Supera los límites del régimen courier", d: "El courier tiene un tope de valor y de peso por envío. Si tu compra lo pasa, la Aduana lo saca del régimen simplificado y pide un despacho formal." },
  { t: "Cantidad con fin comercial", d: "Varias unidades iguales o mercadería para revender. La Aduana entiende que no es para uso personal y frena el envío hasta que se regularice." },
  { t: "Productos con intervención de otro organismo", d: "Cosméticos, alimentos, suplementos, productos eléctricos, equipos con Wi-Fi o Bluetooth, juguetes: pueden necesitar el aval de ANMAT, INAL, SENASA, Seguridad Eléctrica o ENACOM." },
  { t: "Valor declarado o documentación en duda", d: "Si el valor no coincide con lo que se compró o falta la factura, la Aduana pide el comprobante de compra y de pago antes de liberar." },
  { t: "Datos del destinatario incompletos", d: "CUIT o CUIL mal cargado, nombre que no coincide o falta de habilitación para importar: el envío queda esperando hasta que se corrijan." },
  { t: "Mensajes del courier que no se entienden", d: "\"Documentación disponible para agente externo\", \"retenido por Aduana\", \"pendiente de liberación\": te explicamos qué significa en tu caso y qué hay que hacer." },
];

export const PASOS = [
  { t: "Nos escribís", d: "Por WhatsApp, con el número de tracking y lo que compraste. Si tenés la factura o el comprobante, mejor." },
  { t: "Vemos por qué quedó retenido", d: "Revisamos el estado en el courier y en la Aduana, y te decimos qué falta, cuánto cuesta y cuánto puede tardar. Antes de empezar, sin compromiso." },
  { t: "Hacemos el trámite", d: "Armamos la documentación, gestionamos los permisos que hagan falta y hacemos el seguimiento con la Aduana y el courier." },
  { t: "Tu envío liberado", d: "Cuando queda liberado lo retirás en nuestra oficina de Buenos Aires o te lo enviamos. Te avisamos en cada paso." },
];

export const NECESITAMOS = [
  "Número de guía o tracking (DHL, FedEx, UPS u otro courier)",
  "Factura o comprobante de compra",
  "Comprobante de pago (tarjeta, PayPal, transferencia)",
  "Tu DNI y CUIT o CUIL",
  "Fotos o links de los productos",
  "El aviso o mail del courier, si te llegó uno",
];

export const FAQ = [
  { q: "¿Cuánto cuesta liberar un envío retenido en la Aduana?", a: "Depende del motivo de la retención, del valor de la mercadería y de si hace falta algún permiso de otro organismo. Antes de empezar te pasamos el costo total, sin compromiso, para que decidas con los números claros." },
  { q: "¿Cuánto tarda la liberación?", a: "Cuando solo falta documentación puede resolverse en pocos días hábiles. Si la mercadería necesita una intervención (ANMAT, INAL, Seguridad Eléctrica, ENACOM) los plazos dependen del organismo. Te damos una estimación apenas vemos tu caso." },
  { q: "¿Qué pasa si no libero el envío?", a: "El courier y el depósito cobran almacenaje por cada día que la carga queda retenida y, pasado un tiempo, la mercadería puede quedar en rezago o abandonada a favor del Estado. Cuanto antes se empieza, menos se paga." },
  { q: "¿Sirve para envíos de DHL, FedEx y UPS?", a: "Sí. Trabajamos con envíos retenidos de DHL, FedEx, UPS y otros couriers, sean compras en AliExpress, Amazon, Alibaba, Shein, Temu o directo a un proveedor." },
  { q: "¿Tengo que estar inscripto como importador?", a: "No siempre. Depende del tipo de mercadería y de la cantidad. Revisamos tu caso y te decimos cuál es el camino más simple para liberarlo." },
  { q: "Mi tracking dice \"Documentación disponible para agente externo\". ¿Qué significa?", a: "Que el envío salió del régimen courier y la Aduana pide un despacho formal hecho por un tercero. Es el caso más común de envío retenido: escribinos con el tracking y te decimos cómo seguir." },
  { q: "¿Puedo evitar que me vuelva a pasar?", a: "Sí. Si importás seguido, podemos traer tus compras con nuestro servicio de flete aéreo o marítimo: nos ocupamos de la Aduana desde el principio y la mercadería llega sin sorpresas." },
];
