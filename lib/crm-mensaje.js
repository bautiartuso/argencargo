// lib/crm-mensaje.js — la voz de Bauti para los mensajes de seguimiento (26/11/2026). Sale de leer sus
// chats reales: sin tildes, sin signos de apertura, corto, "querido" solo a hombres, y una pregunta
// distinta según el grupo (al que importó se le pregunta por él y el negocio; al que cotizó, por lo
// que cotizó; al que nunca cotizó, bien suelto). El saludo y la idea se eligen con la persona como
// semilla, para que no salgan todos iguales. Funciones puras: las usa el análisis de la IA
// (lib/crm-analisis.js, que redacta con esto como guía) y Seguimiento cuando todavía no hay análisis.
export const SALUDO_H = ["Querido como va? todo bien?", "Hola querido, como andas?", "{n} querido, como va?", "Hola {n}, como andas? todo bien?", "{n} como va? todo bien?", "Hola {n}, como va?", "Querido como andas? todo bien?", "Hola {n} querido, como estas?", "Hola {n}, como estas? todo bien?", "Querido como vaa"];
export const SALUDO_M = ["Hola {n}, como andas? todo bien?", "{n} como va? todo bien?", "Hola {n}, como estas? todo bien?", "Hola {n}, como va?", "{n} como andas? todo bien?"];
export const SALUDO_N = ["Hola, como va? todo bien?", "Buenas, como va?", "Hola, como andas? todo bien?"];
export const IDEAS = {
  importo: ["volviste a importar algo?", "estas importando algo actualmente?", "como viene el negocio?", "estas trayendo algo ultimamente?", "andas con algo para traer?", "como vienen las ventas?", "seguis importando?", "como te fue con lo ultimo que trajiste? estas por traer algo mas?"],
  cotizo: ["vi que habias cotizado (producto), seguis con la idea de traerlo?", "al final pudiste avanzar con (producto)?", "que onda con (producto), seguis con ganas de traerlo?", "vi la coti de (producto), que te falta para avanzar?", "pudiste ver la coti de (producto)? cualquier cosa lo vemos", "vi que estuviste cotizando (producto), lo estas por traer?"],
  nunca: ["che que onda, estas con ganas de traer algo de China?", "venis importando actualmente o seria tu primera vez?", "tenes algo en mente para traer?", "que andas buscando traer?", "pudiste ver algo para importar?", "estas importando algo actualmente?"],
  lead: ["pudiste ver lo que hablamos?", "al final avanzaste con eso?", "te quedo alguna duda con lo que vimos?", "seguis con la idea de traerlo?", "que onda, pudiste avanzar?"],
};
export const CIERRES = ["", "", "", "cualquier cosa avisame", "lo que necesites avisame", "avisame y lo vemos"];
export const PRESENTACION = "Bauti de Argencargo por aca";
export const GRUPO = { importo: "importó y no volvió", cotizo: "cotizó y no importó", nunca: "se registró y nunca cotizó", lead: "escribió por WhatsApp y no se registró" };

const semilla = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const elegir = (lista, s) => lista[semilla(s) % lista.length];
const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// "Querido" solo cuando el nombre es de hombre sin dudas; ante la duda, el saludo con el nombre y listo.
const HOMBRES = new Set("juan jose luis carlos martin nicolas nico sebastian seba matias mati lucas tomas tomi agustin joaquin joaco ivan hernan cesar hector daniel gabriel david javier javi oscar victor miguel migue angel manuel manu samuel ezequiel eze nahuel nahue joel axel alan brian bryan kevin jonathan jonatan jony cristian christian fabian damian dami julian adrian esteban german ruben raul jorge enrique quique felipe vicente walter gaston franco bruno thiago tiago santino benjamin benja bautista bauti luca lucca facu fede maxi nacho lucho gus rodri santi guille gonza rami rober edu mauri octa rodo beto pato leo lean lauti juampi juanma juanjo rafa rolo uri tobi salva osva uli gera ema jere fabri marcos mateo simon ian igor elias isaias jeremias tobias matheus mathias diego pedro pablo sergio ricardo ricky roberto alberto eduardo fernando gustavo guido hugo ignacio leonardo leandro lautaro marcelo mariano mario mauricio maximo maximiliano norberto osvaldo patricio ramiro rodrigo rodolfo santiago federico francisco facundo emiliano emilio alejandro alfredo antonio armando arturo claudio dario dante emanuel fabricio gerardo gonzalo horacio julio lisandro lorenzo marco mauro nestor omar orlando rolando ulises valentino renzo alejo dylan dilan jairo yair edgar josue justino exequiel geronimo eugenio roman norman branco tom tommy andy alex".split(" "));
export function esHombre(nombre) {
  const k = sinTildes(nombre).split(/\s+/)[0];
  return !!k && HOMBRES.has(k);
}

// El saludo ya armado para esta persona. sexo: "h" | "m" | "n" (sin nombre o no es de persona).
export function saludoDe(clave, pila, sexo, vuelta = 0) {
  const s = `${clave}:${vuelta}`;
  if (!pila || sexo === "n") return elegir(SALUDO_N, s + "n");
  return elegir(sexo === "h" ? SALUDO_H : SALUDO_M, s + sexo).replace("{n}", pila);
}
export const ideaDe = (clave, grupo, vuelta = 0) => elegir(IDEAS[grupo] || IDEAS.nunca, `${clave}:${vuelta}i`);
export const cierreDe = (clave, vuelta = 0) => elegir(CIERRES, `${clave}:${vuelta}c`);

// Mensaje armado sin IA, para quien todavía no tiene análisis (el que se registró y nunca cotizó no
// se analiza: no hay nada para leer). producto = lo que cotizó en pocas palabras, si se sabe.
export function mensajeBase({ clave, grupo, pila, presentarse, producto, vuelta = 0 }) {
  const sexo = !pila ? "n" : esHombre(pila) ? "h" : "m";
  const saludo = saludoDe(clave, pila, sexo, vuelta);
  let idea = ideaDe(clave, grupo, vuelta);
  if (grupo === "lead") idea = "";
  else if (grupo === "cotizo") idea = `vi que habias cotizado${producto ? ` ${producto}` : ""}, seguis con la idea de importar?`;
  else if (/lo ultimo que trajiste/.test(idea)) idea = IDEAS.importo[0];
  const cierre = idea && grupo !== "importo" && !/avisame|lo vemos/.test(idea) ? cierreDe(clave, vuelta) : "";
  const arriba = presentarse ? `${saludo}${/[?!]$/.test(saludo) ? "" : ","} ${PRESENTACION}` : saludo;
  const abajo = [idea, cierre].filter(Boolean).join(" ");
  return [arriba, abajo].filter(Boolean).join("\n");
}
