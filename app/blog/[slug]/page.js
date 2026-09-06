// /blog/[slug] — una nota del blog.
import { notFound } from "next/navigation";
import { notaPorSlug, notasPublicadas, sumarVista } from "../../../lib/blog";
import { Marco, Fecha, fechaLarga, SITE } from "../_estilo";

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const n = await notaPorSlug(params.slug);
  if (!n) return { title: "Nota no encontrada" };
  const url = `${SITE}/blog/${n.slug}`;
  return {
    title: n.seo_title || n.title,
    description: n.seo_description || n.excerpt || "",
    alternates: { canonical: url },
    openGraph: { title: n.title, description: n.excerpt || "", url, type: "article", publishedTime: n.published_at, modifiedTime: n.updated_at || n.published_at, images: n.cover_url ? [{ url: n.cover_url, width: 1200, height: 630 }] : undefined },
    twitter: { card: "summary_large_image", title: n.title, description: n.excerpt || "", images: n.cover_url ? [n.cover_url] : undefined },
  };
}

export default async function Nota({ params }) {
  const n = await notaPorSlug(params.slug);
  if (!n) notFound();
  await sumarVista(n.slug);
  const otras = (await notasPublicadas({ limit: 4 })).filter((x) => x.slug !== n.slug).slice(0, 3);
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: n.title, description: n.excerpt || "", datePublished: n.published_at, dateModified: n.updated_at || n.published_at, image: n.cover_url ? [n.cover_url] : undefined, author: { "@type": "Organization", name: "Argencargo", url: SITE }, publisher: { "@type": "Organization", name: "Argencargo", url: SITE }, mainEntityOfPage: `${SITE}/blog/${n.slug}`, inLanguage: "es-AR" };
  return (
    <Marco>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <article className="art">
        <a href="/blog" className="back">← Novedades</a>
        <h1>{n.title}</h1>
        <div className="dateline">{fechaLarga(n.published_at)}{n.reading_min ? ` — ${n.reading_min} min de lectura` : ""}</div>
        {n.excerpt && <p className="std">{n.excerpt}</p>}
        {n.cover_url && <div className="cover"><img src={n.cover_url} alt="" width={1200} height={630} /></div>}
        <div className="nota" dangerouslySetInnerHTML={{ __html: n.content_html || "" }} />
        {n.source_url && <div className="fuente"><span aria-hidden="true">📎</span><div>Esta nota se escribió a partir de <a href={n.source_url} target="_blank" rel="noopener noreferrer">{n.source_title || n.source_name || "la fuente original"}</a>{n.source_name ? ` (${n.source_name})` : ""}. Publicada el {fechaLarga(n.published_at)}.</div></div>}
        {Array.isArray(n.tags) && n.tags.length > 0 && <div className="tags">{n.tags.map((t) => <span key={t}>{t}</span>)}</div>}
        <div className="cta-band"><div>
          <div><h3>¿Estás importando desde China?</h3><p>Cotizá tu envío en dos minutos. Clasificamos cada producto antes de pasarte el número.</p></div>
          <a href="/#cotizar" className="btn">Cotizar mi envío <span>→</span></a>
        </div></div>
      </article>
      {otras.length > 0 && (
        <section className="mas">
          <h2>Más novedades</h2>
          <div className="rows">
            {otras.map((o) => (
              <article key={o.slug} className="row">
                <Fecha d={o.published_at} />
                <div><h3><a href={`/blog/${o.slug}`}>{o.title}</a></h3>{o.excerpt && <p>{o.excerpt}</p>}</div>
              </article>
            ))}
          </div>
        </section>
      )}
    </Marco>
  );
}
