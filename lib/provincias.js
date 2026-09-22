// Provincias para los formularios de Argencargo y ARGENMAQ. Regla de Bautista (22/09/2026): la
// provincia se elige de una lista (nunca a mano), con la Ciudad Autónoma de Buenos Aires arriba
// de todo; la localidad sí se escribe a mano. Los valores son los que ya están guardados en la
// base ("CABA", "Buenos Aires", …) para no romper las fichas existentes: solo cambia la etiqueta.
export const PROVINCIAS = [
  { v: "CABA", l: "Ciudad Autónoma de Buenos Aires" },
  { v: "Buenos Aires", l: "Buenos Aires" },
  ...["Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"].map((p) => ({ v: p, l: p })),
];
export const nombreProvincia = (v) => PROVINCIAS.find((p) => p.v === v)?.l || v || "";
