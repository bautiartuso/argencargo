// GET /api/version — el commit que está en producción. El admin lo compara con el que cargó
// para avisar que hay una versión nueva (una pestaña abierta sigue con el código viejo).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ v: process.env.VERCEL_GIT_COMMIT_SHA || "dev" }, { headers: { "Cache-Control": "no-store" } });
}
