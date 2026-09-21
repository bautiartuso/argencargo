// robots.txt propio de ARGENMAQ (el middleware reescribe /robots.txt hacia acá en su host).
// Sin esto, argenmaq servía el robots de Argencargo, con el sitemap de Argencargo.
import { AM_URL } from "../_marca";

export const dynamic = "force-static";

export function GET() {
  const cuerpo = [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /cc/",
    "Disallow: /api/",
    "",
    `Host: ${AM_URL}`,
    `Sitemap: ${AM_URL}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(cuerpo, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
