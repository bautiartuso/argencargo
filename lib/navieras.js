// Navieras que traen contenedores a Buenos Aires (21/10/2026). Lista cerrada: el admin elige de acá,
// así cada contenedor tiene el logo real y el color de su naviera (admin y portal del cliente).
// Logos oficiales en public/brand/navieras (Wikipedia/Wikimedia; MSC y OOCL los pasó Bautista).
// `sq`: el logo es un cuadrado con su propio fondo (va a sangre); el resto son logotipos sobre blanco.
export const NAVIERAS = [
  { n: "Maersk", c: "#42B0D5", logo: "/brand/navieras/maersk.svg" },
  { n: "MSC", c: "#D9B44A", logo: "/brand/navieras/msc.png", sq: true },
  { n: "CMA CGM", c: "#E2001A", logo: "/brand/navieras/cmacgm.svg" },
  { n: "COSCO", c: "#1C4E9D", logo: "/brand/navieras/cosco.svg" },
  { n: "Hapag-Lloyd", c: "#F26722", logo: "/brand/navieras/hapag.svg" },
  { n: "ONE", c: "#BA0C6E", logo: "/brand/navieras/one.svg" },
  { n: "Evergreen", c: "#00843D", logo: "/brand/navieras/evergreen.svg" },
  { n: "ZIM", c: "#2A3E8C", logo: "/brand/navieras/zim.svg" },
  { n: "HMM", c: "#E2231A", logo: "/brand/navieras/hmm.svg" },
  { n: "Yang Ming", c: "#E60012", logo: "/brand/navieras/yangming.gif" },
  { n: "OOCL", c: "#CE3535", logo: "/brand/navieras/oocl.png", sq: true },
  { n: "PIL", c: "#0068B4", logo: "/brand/navieras/pil.svg" },
  { n: "Wan Hai", c: "#1F3C88", logo: "/brand/navieras/wanhai.png" },
];
export const navieraDe = (n) => NAVIERAS.find((x) => x.n.toLowerCase() === String(n || "").trim().toLowerCase()) || null;
export const navieraColor = (n) => navieraDe(n)?.c || "#60a5fa";
