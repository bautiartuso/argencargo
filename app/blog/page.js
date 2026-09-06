// /blog — novedades de comercio exterior escritas por Argencargo (blog_posts publicadas).
import { notasPublicadas } from "../../lib/blog";
import { Marco, GOLD, fecha } from "./_estilo";

export const revalidate = 300;
export const metadata = {
  title: "Novedades de comercio exterior e importación",
  description: "Cambios en aduana, régimen courier, aranceles y consejos para importar desde China, explicados en simple por Argencargo.",
  alternates: { canonical: "https://www.argencargo.com.ar/blog" },
  openGraph: { title: "Novedades · Argencargo", description: "Comercio exterior e importación explicados en simple.", url: "https://www.argencargo.com.ar/blog", type: "website" },
};

export default async function BlogIndex() {
  const notas = await notasPublicadas({ limit: 30 });
  return (
    <Marco>
      <h1 style={{ fontSize: 34, fontWeight: 900, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>Novedades</h1>
      <p style={{ margin: "0 0 26px", color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Lo que cambia en comercio exterior e importación, explicado en simple.</p>
      {notas.length === 0 && <p style={{ color: "rgba(255,255,255,0.5)" }}>Todavía no hay notas publicadas.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 18 }}>
        {notas.map((n) => (
          <a key={n.slug} href={`/blog/${n.slug}`} style={{ textDecoration: "none", color: "inherit", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ aspectRatio: "1200/630", background: "#0F1F3A" }}>{n.cover_url && <img src={n.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</div>
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <span style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{fecha(n.published_at)}{n.reading_min ? ` · ${n.reading_min} min` : ""}</span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>{n.title}</h2>
              {n.excerpt && <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.62)", lineHeight: 1.5 }}>{n.excerpt}</p>}
            </div>
          </a>
        ))}
      </div>
    </Marco>
  );
}
