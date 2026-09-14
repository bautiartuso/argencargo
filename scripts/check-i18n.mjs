#!/usr/bin/env node
// Chequeo del i18n del portal. Corre con: node scripts/check-i18n.mjs
//
// Existe porque estos errores rompieron el build o el runtime una vez cada uno y ninguno
// se ve a simple vista:
//  1) t() dentro de una constante de MODULO -> el modulo tira ReferenceError al cargarse y
//     el prerender de /portal falla. OJO: el build imprime "Compiled successfully" y aun asi
//     termina en exit 1, asi que es muy facil no verlo.
//  2) t() en un componente sin useT() -> crash en runtime, solo cuando se renderiza esa parte.
//  3) atributo JSX sin llaves (alt=t("x") en vez de alt={t("x")}) -> error de sintaxis.
//  4) clave usada que no existe en el diccionario -> se muestra la clave cruda al cliente.
//  5) clave sin traducir en algun idioma -> cae a castellano en silencio (el bug original).
import { readFileSync } from "node:fs";

const PORTAL = "app/portal/page.js";
const DICT_FILE = "lib/i18n-portal.js";
const src = readFileSync(PORTAL, "utf8");
const dictSrc = readFileSync(DICT_FILE, "utf8");
const lines = src.split("\n");
let fallas = 0;
const fallar = (msg) => { console.error("x " + msg); fallas++; };

// --- 1) t() a nivel de modulo -------------------------------------------------
{
  let depth = 0, i = 0, line = 1, str = null;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "\n") line++;
    if (str) {
      if (c === "\\") { i += 2; continue; }
      if (c === str) str = null;
      i++; continue;
    }
    if (c === '"' || c === "'") { str = c; i++; continue; }
    if (c === "`") {
      i++;
      while (i < n) {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "`") break;
        if (src[i] === "\n") line++;
        i++;
      }
      i++; continue;
    }
    if (c === "{" || c === "(") depth++;
    else if (c === "}" || c === ")") depth--;
    if (depth === 0 && src.startsWith("t(", i)) {
      const prev = i === 0 ? "" : src[i - 1];
      // Si la sentencia que lo contiene recibe `t` como parametro (ej. stLabelOf=(op,t)=>...),
      // el t() es legitimo: se resuelve al llamarla, no al cargar el modulo.
      const ini = Math.max(src.lastIndexOf("\nconst ", i), src.lastIndexOf("\nfunction ", i));
      const cab = ini >= 0 ? src.slice(ini, i) : "";
      const m = cab.match(/\(([^)]*)\)\s*=>/);
      const recibeT = !!m && m[1].split(",").map((x) => x.trim()).includes("t");
      if (!/[\w$.]/.test(prev) && !recibeT) {
        fallar(`${PORTAL}:${line} - t() en una constante de modulo. Se evalua al cargar el archivo, cuando todavia no hay traductor. Pasalo a una funcion que reciba el traductor.`);
      }
    }
    i++;
  }
}

// --- 2) componentes que usan t() sin useT() ----------------------------------
{
  const bloques = [];
  lines.forEach((l, idx) => {
    const m = l.match(/^(?:export default )?function ([A-Za-z_]\w*)/);
    if (m) bloques.push({ idx, name: m[1] });
  });
  bloques.push({ idx: lines.length, name: "__EOF__" });
  for (let k = 0; k < bloques.length - 1; k++) {
    const { idx, name } = bloques[k];
    const body = lines.slice(idx, bloques[k + 1].idx).join("\n");
    const usa = /(?<![\w.$])t\(\s*["'`]/.test(body) || /\$\{t\(/.test(body);
    // Una funcion que recibe `t` por parametro (suelto o desestructurado) no necesita useT():
    // el traductor se lo pasa quien la llama. Ej: printPortalCalcPdf({...,t}).
    const firma = (body.match(/^(?:export default )?function \w+\(([\s\S]*?)\)\s*\{/) || [])[1] || "";
    const recibeT = /(^|[({,\s])t\s*([,)}=]|$)/.test(firma);
    if (usa && !/useT\(\)/.test(body) && !recibeT) {
      fallar(`${PORTAL}:${idx + 1} - ${name}() usa t() y no tiene useT(). Es un crash en runtime.`);
    }
  }
}

// --- 3) atributos JSX sin llaves ---------------------------------------------
lines.forEach((l, idx) => {
  // attr=t("x") dentro de una etiqueta. Se excluyen las asignaciones JS (obj.prop=t(...)),
  // que son validas: el patron exige espacio o '<' antes del nombre del atributo.
  const m = l.match(/[\s<]([a-zA-Z][\w-]*)=t\("/);
  if (m) fallar(`${PORTAL}:${idx + 1} - atributo JSX '${m[1]}' sin llaves: va ${m[1]}={t("...")}.`);
});

// --- 4) claves usadas que no existen en el diccionario -----------------------
{
  const existentes = new Set([...dictSrc.matchAll(/^\s*"([\w.ñ]+)":\s*\{/gm)].map((m) => m[1]));
  // Las claves armadas con template literal (t(`tax.${x}`)) no se pueden resolver de forma
  // estatica: al capturarlas quedan terminadas en "." y se ignoran.
  const usadas = new Set(
    [...src.matchAll(/(?<![\w.$])t\(\s*"([\w.ñ]+)"/g)].map((m) => m[1]).filter((k) => !k.endsWith("."))
  );
  const faltan = [...usadas].filter((k) => !existentes.has(k));
  if (faltan.length) fallar(`claves usadas que no estan en el diccionario (se mostraria la clave cruda): ${faltan.join(", ")}`);
}

// --- 5) idiomas incompletos --------------------------------------------------
{
  const entradas = [...dictSrc.matchAll(/^\s*"([\w.ñ]+)":\s*\{(.*)\},?\s*$/gm)];
  for (const lang of ["es", "en", "zh", "ru"]) {
    // El diccionario usa comillas simples cuando el propio texto lleva comillas dobles.
    const re = new RegExp("\\b" + lang + ":\\s*[\"']");
    const faltan = entradas.filter((m) => !re.test(m[2])).map((m) => m[1]);
    if (faltan.length) {
      fallar(`${faltan.length} clave(s) sin traduccion en '${lang}': ${faltan.slice(0, 6).join(", ")}${faltan.length > 6 ? "..." : ""}`);
    }
  }
  console.log(`  diccionario: ${entradas.length} claves x 4 idiomas`);
}

if (fallas) { console.error(`\n${fallas} problema(s) de i18n.`); process.exit(1); }
console.log("ok - i18n del portal sin problemas");
