// Familia de mercadería (20/11/2026).
//
// Por qué existe: cada renglón de una lista se clasificaba solo, en paralelo, y la memoria de
// clasificaciones solo reconocía el texto EXACTO. "Línea de pesca PE 4X, 500 m" y "Línea de pesca
// PE 12X, 500 m" eran dos preguntas distintas a la IA y volvían con dos posiciones (5607.50.90 y
// 5404.19.19) en la misma cotización. Hasta acá se emparchaba producto por producto (auriculares,
// almohadillas, póker, masajeadores…).
//
// La familia es la descripción sin lo que distingue variantes de un mismo producto: medidas,
// cantidades, modelos con números, colores y palabras de relleno. Todas las variantes de una
// familia llevan UNA sola posición (tabla ncm_familias; la primera que se clasifica la fija y una
// corrección del admin la pisa).

const VACIAS = new Set((
  "de del la las el los un una uno unos unas en con sin para por al lo su sus que the and with for of to in on or by at a an " +
  "mm cm mt mts kg gr ml lt lts un uds ud unidad unidades pc pcs pieza piezas pack packs paquete paquetes set sets kit par pares caja cajas rollo rollos " +
  "varios varias vario tamano tamanos talle talles size sizes color colores colors colour assorted surtido surtidos modelo modelos model tipo type nuevo nueva new " +
  "rojo roja rojos azul azules verde verdes amarillo amarilla amarillos negro negra negros blanco blanca blancos gris grises rosa rosas naranja violeta marron dorado dorada plateado plateada celeste beige transparente " +
  "black white red blue green yellow pink grey gray gold silver purple orange brown clear"
).split(/\s+/));

// Tokens que definen la familia: sin acentos, sin números ni códigos con números, sin relleno.
export function tokensFamilia(description) {
  const out = new Set();
  String(description || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).forEach((w) => {
      if (w.length < 2 || /\d/.test(w)) return;
      if (VACIAS.has(w)) return;
      const s = w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w; // plural simple
      if (VACIAS.has(s)) return;
      out.add(s);
    });
  return [...out].sort();
}

// Clave de la familia, o null si la descripción es demasiado corta (una sola palabra no alcanza
// para decir que dos cosas son lo mismo) o demasiado larga (una ficha técnica entera).
export function familiaDe(description) {
  const t = tokensFamilia(description);
  return t.length >= 2 && t.length <= 12 ? t.join(" ") : null;
}

// Parecido entre dos familias (0 a 1): palabras en común sobre el total de palabras distintas.
export function parecido(a, b) {
  const A = new Set(String(a).split(" ")), B = new Set(String(b).split(" "));
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return { score: inter / (A.size + B.size - inter), inter };
}

// La familia más parecida de una lista [{ familia, ncm_code }] (ordenada de más vieja a más nueva):
// al menos 2 palabras en común y 70 % de parecido. Empate → la más vieja.
export function familiaParecida(fam, filas) {
  let best = null;
  for (const f of filas || []) {
    const p = parecido(fam, f.familia);
    if (p.inter >= 2 && p.score >= 0.7 && p.score > (best?.score || 0)) best = { ...f, score: p.score };
  }
  return best;
}
