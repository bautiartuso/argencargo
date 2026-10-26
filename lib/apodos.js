// Apodos para los mensajes de seguimiento (27/10/2026): "Hola Eli" en vez de "Hola Eliana".
// Nombres compuestos conocidos primero (Juan Pablo → Juampi); si no, el primer nombre con su apodo;
// si no hay apodo, el nombre tal cual. Sin tildes para comparar.
const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const COMPUESTOS = {
  "juan pablo": "Juampi", "juan manuel": "Juanma", "juan ignacio": "Nacho", "juan cruz": "Juan Cruz", "juan martin": "Juan Martín", "juan carlos": "Juan Carlos", "juan jose": "Juanjo", "juan diego": "Juan Diego",
  "jose luis": "José Luis", "jose maria": "José María", "maria jose": "Majo", "maria eugenia": "Euge", "maria laura": "Lau", "maria belen": "Belu", "maria florencia": "Flor", "maria victoria": "Vicky", "maria paula": "Pau", "maria sol": "Sol", "maria luz": "Luz", "maria emilia": "Emi", "maria fernanda": "Fer", "maria celeste": "Cele", "maria soledad": "Sole", "maria de los angeles": "Mari", "maria del carmen": "Mari", "maria pia": "Pía", "maria agustina": "Agus", "maria guadalupe": "Guada", "maria lujan": "Luján", "maria julia": "Juli", "maria noel": "Noe",
  "ana paula": "Anita", "ana laura": "Lau", "ana clara": "Ana Clara", "ana maria": "Ana María", "luis alberto": "Lucho", "carlos alberto": "Carlos", "jorge luis": "Jorge", "miguel angel": "Migue", "victor hugo": "Víctor", "marcos antonio": "Marcos",
};
const APODOS = {
  eliana: "Eli", emiliano: "Emi", emilia: "Emi", emilio: "Emi", javier: "Javi", lucio: "Lucho", luciano: "Lucho", luis: "Lucho", gustavo: "Gus", fernando: "Fer", fernanda: "Fer", maximo: "Maxi", maximiliano: "Maxi",
  sebastian: "Seba", nicolas: "Nico", federico: "Fede", francisco: "Fran", francisca: "Fran", florencia: "Flor", alejandro: "Ale", alejandra: "Ale", alexis: "Ale", agustin: "Agus", agustina: "Agus", matias: "Mati", gabriel: "Gabi", gabriela: "Gabi",
  daniel: "Dani", daniela: "Dani", rodrigo: "Rodri", cristian: "Cris", cristina: "Cris", santiago: "Santi", ezequiel: "Eze", ignacio: "Nacho", joaquin: "Joaco", guillermo: "Guille", valentina: "Valen", valentin: "Valen", micaela: "Mica", camila: "Cami", carolina: "Caro",
  lorena: "Lore", veronica: "Vero", marcelo: "Marce", marcela: "Marce", leonardo: "Leo", leandro: "Lean", nahuel: "Nahue", tomas: "Tomi", facundo: "Facu", jonathan: "Jony", jonatan: "Jony", patricio: "Pato", patricia: "Patri", ramiro: "Rami", roberto: "Rober", eduardo: "Edu", mauricio: "Mauri",
  octavio: "Octa", bautista: "Bauti", benjamin: "Benja", rodolfo: "Rodo", alberto: "Beto", gonzalo: "Gonza", ariel: "Ari", adrian: "Adri", sofia: "Sofi", antonella: "Anto", jimena: "Jime", julieta: "Juli", julian: "Juli", natalia: "Nati", noelia: "Noe", paula: "Pau", pamela: "Pame",
  romina: "Ro", roxana: "Roxi", sabrina: "Sabri", soledad: "Sole", tamara: "Tami", vanesa: "Vane", vanessa: "Vane", victoria: "Vicky", yanina: "Yani", mercedes: "Mechi", guadalupe: "Guada", constanza: "Coti", milagros: "Mili", rocio: "Ro", lautaro: "Lauti", damian: "Dami", claudio: "Clau", claudia: "Clau",
  osvaldo: "Osva", ulises: "Uli", gerardo: "Gera", josefina: "Jose", manuel: "Manu", emanuel: "Ema", jeremias: "Jere", fabian: "Fabi", fabricio: "Fabri", rafael: "Rafa", rolando: "Rolo", silvia: "Silvi", susana: "Susi", monica: "Moni", belen: "Belu", brenda: "Bren", ayelen: "Aye", abril: "Abri",
  candela: "Cande", catalina: "Cata", celeste: "Cele", debora: "Debi", estefania: "Estefi", gisela: "Gise", jesica: "Jesi", jessica: "Jesi", karina: "Kari", laura: "Lau", lucia: "Lu", luciana: "Lu", magali: "Maga", melina: "Meli", melisa: "Meli", ornella: "Orne", priscila: "Pri", virginia: "Virgi", ximena: "Xime", daiana: "Dai",
  enrique: "Quique", felipe: "Feli", salvador: "Salva", tobias: "Tobi", uriel: "Uri", miguel: "Migue", norberto: "Norber", alfredo: "Alfre", ricardo: "Ricky", gaston: "Gastón", maria: "Mari", mariana: "Mari", marina: "Mari", andrea: "Andre", andres: "Andy", juani: "Juani", alex: "Alex", lucas: "Lucas",
  ignacia: "Nachi", delfina: "Delfi", martina: "Martu", juliana: "Juli", maribel: "Mari", mariela: "Mariel", alina: "Ali", maia: "Maia", josue: "Josué", jesus: "Jesús", cesar: "César", hector: "Héctor", ivan: "Iván", hernan: "Hernán", martin: "Martín", andrés: "Andy", nicolás: "Nico", matías: "Mati", sebastián: "Seba", joaquín: "Joaco", valentín: "Valen", agustín: "Agus", adrián: "Adri", fabián: "Fabi", damián: "Dami", tomás: "Tomi", rubén: "Rubén", raúl: "Raúl",
};

export function apodoDe(nombre) {
  const limpio = String(nombre || "").replace(/[^\p{L}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return "";
  const k = sinTildes(limpio);
  for (const [comp, ap] of Object.entries(COMPUESTOS)) if (k === comp || k.startsWith(comp + " ")) return ap;
  const partes = limpio.split(" ");
  // Empresas ("BS AS PRO AUDIO", "XX SRL"): sin apodo; el mensaje arranca con "Hola!".
  if (partes.length >= 2 && (partes.every((p) => /^[A-ZÁÉÍÓÚÑ0-9&.]+$/.test(p)) || /\b(s\.?r\.?l\.?|s\.?a\.?s?|ltda|inc|corp)\b/i.test(limpio))) return "";
  const primero = partes[0];
  const kp = sinTildes(primero);
  // "Maria X" / "Juan X" sin apodo compuesto: va por el segundo nombre, que es el que usan.
  if (["maria", "juan", "jose", "ana", "luis"].includes(kp) && partes[1] && !/^(de|del|los|las|la)$/i.test(partes[1])) {
    const seg = sinTildes(partes[1]);
    if (APODOS[seg]) return APODOS[seg];
    if (kp !== "maria" && kp !== "ana") return `${cap(primero)} ${cap(partes[1])}`;
    return cap(partes[1]);
  }
  if (APODOS[kp]) return APODOS[kp];
  // Nombres de empresa o raros: tal cual, con mayúscula inicial.
  return /^[A-ZÁÉÍÓÚ]{2,}$/.test(primero) ? primero : cap(primero.toLowerCase());
}
