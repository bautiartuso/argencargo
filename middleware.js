// Argenmaq vive en el mismo proyecto que Argencargo, con su propio host (argenmaq.vercel.app hoy,
// el dominio propio cuando Bautista lo compre). Acá se traduce ese host a las rutas internas:
//   /              → /argenmaq              (landing)
//   /admin         → /admin/maquinaria      (panel del equipo)
//   /cc/<token>    → /argenmaq/cc/<token>   (CC Financiera para la financiera, solo lectura)
//   /terminos …    → /argenmaq/terminos …   (legales propias de ARGENMAQ)
//   /robots.txt    → /argenmaq/robots.txt   (si no, servía el de Argencargo, con su sitemap)
//   /sitemap.xml   → /argenmaq/sitemap.xml
//   cualquier otra → /argenmaq/no-encontrado (404 con la marca de ARGENMAQ, no la de Argencargo)
// /api, /_next, el panel y los archivos de /public pasan derecho.
import { NextResponse } from "next/server";

const HOSTS_ARGENMAQ = /^(www\.)?argenmaq\./i;

// Rutas que en el host de ARGENMAQ tienen que llegar tal cual al servidor.
const PASA = [/^\/_next\//, /^\/api\//, /^\/monitoring/, /^\/admin/, /^\/cc\//, /^\/argenmaq/];

// Páginas propias de ARGENMAQ que se sirven desde la raíz de su host.
const PROPIAS = new Set(["/terminos", "/privacidad", "/legal"]);

export function middleware(req) {
  const host = req.headers.get("host") || "";
  if (!HOSTS_ARGENMAQ.test(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const rw = (destino) => NextResponse.rewrite(new URL(destino, req.url));

  if (pathname === "/") return rw("/argenmaq");
  if (pathname === "/admin" || pathname === "/admin/") return rw("/admin/maquinaria");
  if (pathname === "/robots.txt") return rw("/argenmaq/robots.txt");
  if (pathname === "/sitemap.xml") return rw("/argenmaq/sitemap.xml");
  if (pathname.startsWith("/cc/")) return rw(`/argenmaq${pathname}`); // link público de la CC Financiera
  if (PROPIAS.has(pathname) || PROPIAS.has(pathname.replace(/\/$/, ""))) return rw(`/argenmaq${pathname.replace(/\/$/, "")}`);

  if (PASA.some((re) => re.test(pathname))) return NextResponse.next();
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next(); // íconos, imágenes y demás de /public

  // Nada de Argencargo se sirve desde el host de ARGENMAQ: el resto es 404 de ARGENMAQ.
  return rw("/argenmaq/no-encontrado");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
