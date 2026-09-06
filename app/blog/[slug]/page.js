// /blog/[slug] — una nota del blog.
import { notFound } from "next/navigation";
import { notaPorSlug, notasPublicadas, sumarVista } from "../../../lib/blog";
import { Marco, GOLD, fecha } from "../_estilo";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const n = await notaPorSlug(params.slug);
  if (!n) return { title: "Nota no encontrada" };
  const url = `https://www.argencargo.com.ar/blog/${n.slug}`;
  return {
    title: n.seo_title || n.title,
    description: n.seo_description || n.excerpt || "",
    alternates: { canonical: url },
    openGraph: { title: n.title, description: n.excerpt || "", url, type: "article", publishedTime: n.published_at, images: n.cover_url ? [{ url: n.cover_url, width: 1200, height: 630 }] : undefined },
    twitter: { card: "summary_large_image", title: n.title, description: n.excerpt || "", images: n.cover_url ? [n.cover_url] : undefined },
  };
}

const PROSE = `
.nota h2{font-size:22px;font-weight:800;margin:28px 0 10px;line-height:1.3}
.nota h3{font-size:18px;font-weight:700;margin:22px 0 8px}
.nota p{font-size:16.5px;line-height:1.7;margin:0 0 16px;color:rgba(255,255,255,0.86)}
.nota ul,.nota ol{padding-left:22px;margin:0 0 16px;color:rgba(255,255,255,0.86);line-height:1.65}
.nota li{margin-bottom:6px}
.nota a{color:#E8C99B}
.nota blockquote{margin:0 0 16px;padding:10px 16px;border-left:3px solid #E8C99B;background:rgba(255,255,255,0.04);border-radius:0 10px 10px 0}
.nota strong{color:#fff}
`;

export default async function Nota({ params }) {
  const n = await notaPorSlug(params.slug);
  if (!n) notFound();
  await sumarVista(n.slug);
  const otras = (await notasPublicadas({ limit: 4 })).filter((x) => x.slug !== n.slug).slice(0, 3);
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: n.title, description: n.excerpt || "", datePublished: n.published_at, dateModified: n.updated_at || n.published_at, image: n.cover_url ? [n.cover_url] : undefined, author: { "@type": "Organization", name: "Argencargo" }, publisher: { "@type": "Organization", name: "Argencargo" }, mainEntityOfPage: `https://www.argencargo.com.ar/blog/${n.slug}` };
  return (
    <Marco>
      <style dangerouslySetInnerHTML={{ __html: PROSE }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <article style={{ maxWidth: 760, margin: "0 auto" }}>
        <a href="/blog" style={{ color: GOLD, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>← Novedades</a>
        <p style={{ margin: "14px 0 6px", fontSize: 12, color: GOLD, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{fecha(n.published_at)}{n.reading_min ? ` · ${n.reading_min} min de lectura` : ""}</p>
        <h1 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.15, margin: "0 0 14px", letterSpacing: "-0.01em" }}>{n.title}</h1>
        {n.excerpt && <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, margin: "0 0 20px" }}>{n.excerpt}</p>}
        {n.cover_url && <img src={n.cover_url} alt="" style={{ width: "100%", borderRadius: 14, display: "block", marginBottom: 26 }} />}
        <div className="nota" dangerouslySetInnerHTML={{ __html: n.content_html || "" }} />
        {n.source_url && <p style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Fuente: <a href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>{n.source_name || n.source_url}</a></p>}
        {Array.isArray(n.tags) && n.tags.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>{n.tags.map((t) => <span key={t} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)" }}>{t}</span>)}</div>}
        <div style={{ marginTop: 34, padding: "18px 20px", borderRadius: 14, background: "rgba(232,201,155,0.08)", border: "1px solid rgba(232,201,155,0.25)" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 15 }}>¿Estás importando o pensando en hacerlo?</p>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Cotizá tu envío desde China en dos minutos o escribinos, sin compromiso.</p>
          <a href="/#cotizar" style={{ display: "inline-block", background: GOLD, color: "#0A1628", textDecoration: "none", fontWeight: 800, fontSize: 13, padding: "9px 16px", borderRadius: 9 }}>Cotizar ahora</a>
        </div>
      </article>
      {otras.length > 0 && (
        <section style={{ maxWidth: 760, margin: "44px auto 0" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>Más novedades</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {otras.map((o) => <a key={o.slug} href={`/blog/${o.slug}`} style={{ textDecoration: "none", color: "inherit", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}><span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>{fecha(o.published_at)}</span><p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{o.title}</p></a>)}
          </div>
        </section>
      )}
    </Marco>
  );
}
