// Blog público de Argencargo: lenguaje editorial sobre la marca (navy profundo, dorado contenido,
// serif de display para los títulos + Inter para el cuerpo). La fecha es protagonista: cada nota
// se lee como una entrada fechada de un cuaderno de comercio exterior.
export const SITE = "https://www.argencargo.com.ar";
export const LOGO = "https://nhfslvixhlbiyfmedmbr.supabase.co/storage/v1/object/public/assets/logo_argencargo.png";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Fechas en hora Argentina (el servidor corre en UTC).
const ar = (d) => new Date(new Date(d).getTime() - 3 * 3600000);
export const fechaLarga = (d) => { if (!d) return ""; const x = ar(d); return `${x.getUTCDate()} de ${MESES[x.getUTCMonth()]} de ${x.getUTCFullYear()}`; };
export const fechaPartes = (d) => { const x = ar(d || Date.now()); return { dia: String(x.getUTCDate()).padStart(2, "0"), mes: MES3[x.getUTCMonth()], anio: x.getUTCFullYear() }; };

export const CSS = `
:root{--bg:#0a1223;--bg2:#0F1F3A;--ink:#FFFFFF;--ink2:#B9C2D3;--mute:#7E8AA3;--ac:#3B7DD8;--ac2:#5B93E6;--line:rgba(255,255,255,0.08);--sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.bg{min-height:100vh;background:radial-gradient(1100px 600px at 80% -10%,rgba(59,125,216,0.12),transparent 60%),radial-gradient(900px 500px at -10% 100%,rgba(21,45,84,0.5),transparent 60%),var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:12px 0;background:rgba(10,18,35,0.92);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.06);font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
.nav-in{max-width:1200px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:center}
.nav-in img{height:34px;display:block}
.nav-links{display:flex;align-items:center;gap:24px}
.nav-links a{font-size:13px;font-weight:500;color:rgba(255,255,255,0.6);text-decoration:none}
.nav-links a.on{color:#fff;font-weight:600}
.nav-links a.login{font-weight:600;color:#3B7DD8}
.nav-links a.cta{padding:8px 20px;font-size:12px;font-weight:700;border-radius:8px;background:linear-gradient(135deg,#3B7DD8,#152D54);color:#fff}
.wrap{max-width:1080px;margin:0 auto;padding:100px 22px 80px}
.masthead{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:1px solid var(--line);margin-bottom:34px}
.masthead h1{font-weight:800;font-size:clamp(36px,5vw,56px);line-height:1;margin:0;letter-spacing:-0.03em}
.masthead p{margin:0;max-width:34ch;color:var(--ink2);font-size:15px;line-height:1.5}
.lead{display:grid;grid-template-columns:1.15fr 1fr;gap:38px;align-items:center;padding:8px 0 44px;border-bottom:1px solid var(--line);margin-bottom:12px;animation:rise .9s cubic-bezier(.32,.72,0,1) both}
.lead .cover{border-radius:22px;padding:6px;background:rgba(59,125,216,0.08);border:1px solid rgba(59,125,216,0.18)}
.lead .cover img{width:100%;height:auto;display:block;border-radius:17px;aspect-ratio:1200/630;object-fit:cover}
.dateline{display:flex;align-items:center;gap:12px;color:var(--ac2);font-size:13px;font-weight:600;margin-bottom:14px}
.dateline:before{content:"";width:28px;height:2px;border-radius:2px;background:var(--ac)}
.lead h2{font-weight:800;font-size:clamp(26px,3vw,36px);line-height:1.15;margin:0 0 14px;letter-spacing:-0.025em}
.lead h2 a,.row h3 a{color:inherit;text-decoration:none}
.lead h2 a:hover,.row h3 a:hover{color:var(--ac2)}
.lead p{color:var(--ink2);font-size:16px;line-height:1.6;margin:0 0 18px;max-width:52ch}
.more{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:600;font-size:14px}
.more span{width:30px;height:30px;border-radius:999px;background:rgba(59,125,216,0.18);display:inline-flex;align-items:center;justify-content:center;color:var(--ac2);transition:transform .35s cubic-bezier(.32,.72,0,1)}
.more:hover span{transform:translateX(3px)}
.rows{display:flex;flex-direction:column}
.row{display:grid;grid-template-columns:92px 1fr 180px;gap:26px;align-items:center;padding:26px 0;border-bottom:1px solid var(--line)}
.date{color:#fff;line-height:1}
.date b{display:block;font-size:40px;font-weight:800;letter-spacing:-0.04em}
.date small{display:block;font-size:12px;font-weight:600;color:var(--ac2);margin-top:6px;letter-spacing:0.02em;text-transform:capitalize}
.row h3{font-weight:800;font-size:22px;line-height:1.2;margin:0 0 8px;letter-spacing:-0.02em}
.row p{margin:0;color:var(--ink2);font-size:14.5px;line-height:1.55;max-width:62ch}
.row .min{margin-top:8px;font-size:12px;color:var(--mute)}
.row img{width:100%;height:auto;aspect-ratio:1200/630;object-fit:cover;border-radius:12px;display:block}
.empty{padding:60px 0;color:var(--mute);font-size:15px}
/* Nota */
.art{max-width:720px;margin:0 auto}
.back{color:var(--ac2);text-decoration:none;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
.art h1{font-weight:800;font-size:clamp(30px,4.2vw,44px);line-height:1.12;letter-spacing:-0.03em;margin:18px 0 16px}
.art .std{font-size:18px;line-height:1.55;color:var(--ink2);margin:0 0 22px;font-weight:400}
.art .cover{border-radius:20px;padding:5px;background:rgba(59,125,216,0.08);border:1px solid rgba(59,125,216,0.18);margin:0 0 32px}
.art .cover img{width:100%;height:auto;display:block;border-radius:16px}
.nota{font-size:17px;line-height:1.75;color:rgba(255,255,255,0.86)}
.nota h2{font-weight:800;font-size:24px;line-height:1.25;margin:36px 0 12px;letter-spacing:-0.02em;color:var(--ink)}
.nota h3{font-weight:700;font-size:19px;margin:26px 0 8px;color:var(--ink)}
.nota p{margin:0 0 18px}
.nota ul,.nota ol{padding-left:22px;margin:0 0 18px}
.nota li{margin-bottom:8px}
.nota a{color:var(--ac2);text-decoration:underline;text-underline-offset:3px}
.nota strong{color:#fff;font-weight:600}
.nota blockquote{margin:0 0 18px;padding:14px 20px;border-left:3px solid var(--ac);background:rgba(59,125,216,0.06);border-radius:0 12px 12px 0;font-size:17px;line-height:1.55;font-weight:500}
.fuente{margin-top:34px;padding:16px 18px;border:1px solid var(--line);border-radius:14px;font-size:13.5px;color:var(--ink2);display:flex;gap:12px;align-items:flex-start}
.fuente a{color:var(--ac2)}
.tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.tags span{font-size:12px;padding:5px 11px;border-radius:999px;border:1px solid var(--line);color:var(--ink2)}
.cta-band{margin-top:44px;border-radius:22px;padding:6px;background:rgba(59,125,216,0.08);border:1px solid rgba(59,125,216,0.2)}
.cta-band > div{border-radius:17px;padding:26px 26px;background:linear-gradient(135deg,rgba(15,31,58,0.9),rgba(10,22,40,0.9));display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.cta-band h3{font-weight:800;font-size:22px;margin:0 0 6px;letter-spacing:-0.02em}
.cta-band p{margin:0;color:var(--ink2);font-size:14.5px;max-width:46ch}
.btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,#3B7DD8,#152D54);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 8px 11px 18px;border-radius:10px;white-space:nowrap}
.btn span{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.14);display:inline-flex;align-items:center;justify-content:center}
.mas{max-width:720px;margin:56px auto 0}
.mas h2{font-weight:800;font-size:20px;margin:0 0 6px;letter-spacing:-0.02em}
.mas .row{grid-template-columns:72px 1fr}
.mas .date b{font-size:32px}
.foot{border-top:1px solid rgba(255,255,255,0.05);padding:28px 22px;text-align:center;font-size:12.5px;color:var(--mute)}
.foot a{color:var(--ink2)}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.lead{animation:none}}
@media (max-width:820px){.nav-links a:not(.on):not(.cta){display:none}.nav-links{gap:14px}.lead{grid-template-columns:1fr;gap:22px}.row{grid-template-columns:64px 1fr;gap:16px}.row img{display:none}.date b{font-size:34px}.masthead{flex-direction:column;align-items:flex-start;gap:10px}.wrap{padding:30px 18px 60px}}
`;

export function Marco({ children }) {
  return (
    <div className="bg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="nav">
        <div className="nav-in">
          <a href="/" aria-label="Argencargo"><img src={LOGO} alt="Argencargo" /></a>
          <div className="nav-links">
            <a href="/#servicios">Servicios</a>
            <a href="/#como-funciona">Cómo funciona</a>
            <a href="/portal">Calculadora</a>
            <a href="/blog" className="on">Blog</a>
            <a href="/portal" className="login">Iniciar sesión</a>
            <a href="/portal" className="cta">Cotizar gratis</a>
          </div>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="foot">Argencargo · Courier y forwarder internacional · <a href="/terminos">Términos</a></footer>
    </div>
  );
}

export function Fecha({ d }) {
  const p = fechaPartes(d);
  return <div className="date"><b>{p.dia}</b><small>{p.mes} {p.anio}</small></div>;
}
