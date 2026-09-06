// /blog — novedades de comercio exterior escritas por Argencargo (blog_posts publicadas).
import { notasPublicadas } from "../../lib/blog";
import { Marco, Fecha, fechaLarga, SITE } from "./_estilo";

export const revalidate = 300;
export const metadata = {
  title: "Blog: novedades de comercio exterior e importación",
  description: "Cambios en aduana, régimen courier, aranceles y consejos para importar desde China, explicados en simple por Argencargo.",
  alternates: { canonical: `${SITE}/blog` },
  openGraph: { title: "Blog · Argencargo", description: "Comercio exterior e importación explicados en simple.", url: `${SITE}/blog`, type: "website" },
};

export default async function BlogIndex() {
  const notas = await notasPublicadas({ limit: 40 });
  const [lead, ...resto] = notas;
  return (
    <Marco>
      <div className="masthead">
        <h1>Blog</h1>
        <p>Lo que cambia en aduana, régimen courier y aranceles, explicado para quien importa desde China.</p>
      </div>
      {!lead && <p className="empty">Todavía no hay notas publicadas. La primera está en camino.</p>}
      {lead && (
        <section className="lead">
          <a href={`/blog/${lead.slug}`} className="cover" aria-label={lead.title}>{lead.cover_url && <img src={lead.cover_url} alt="" width={1200} height={630} />}</a>
          <div>
            <div className="dateline">{fechaLarga(lead.published_at)}{lead.reading_min ? ` — ${lead.reading_min} min de lectura` : ""}</div>
            <h2><a href={`/blog/${lead.slug}`}>{lead.title}</a></h2>
            {lead.excerpt && <p>{lead.excerpt}</p>}
            <a href={`/blog/${lead.slug}`} className="more">Leer la nota <span>→</span></a>
          </div>
        </section>
      )}
      {resto.length > 0 && (
        <div className="rows">
          {resto.map((n) => (
            <article key={n.slug} className="row">
              <Fecha d={n.published_at} />
              <div>
                <h3><a href={`/blog/${n.slug}`}>{n.title}</a></h3>
                {n.excerpt && <p>{n.excerpt}</p>}
                {n.reading_min ? <div className="min">{n.reading_min} min de lectura</div> : null}
              </div>
              <a href={`/blog/${n.slug}`} aria-hidden="true" tabIndex={-1}>{n.cover_url && <img src={n.cover_url} alt="" width={1200} height={630} loading="lazy" />}</a>
            </article>
          ))}
        </div>
      )}
    </Marco>
  );
}
