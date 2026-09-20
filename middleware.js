// Argenmaq vive en el mismo proyecto que Argencargo, con su propio host (argenmaq.vercel.app hoy,
// el dominio propio cuando Bautista lo compre). Acá se traduce ese host a las rutas internas:
//   /            → /argenmaq            (landing, por ahora una página de espera)
//   /admin       → /admin/maquinaria    (panel del equipo)
// Cualquier otra ruta pasa igual, así el panel puede pedir /api/... y /_next/... sin drama.
import { NextResponse } from "next/server";

const HOSTS_ARGENMAQ = /^(www\.)?argenmaq\./i;

export function middleware(req) {
  const host = req.headers.get("host") || "";
  if (!HOSTS_ARGENMAQ.test(host)) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/") return NextResponse.rewrite(new URL("/argenmaq", req.url));
  if (pathname === "/admin" || pathname === "/admin/") return NextResponse.rewrite(new URL("/admin/maquinaria", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/admin", "/admin/"] };
