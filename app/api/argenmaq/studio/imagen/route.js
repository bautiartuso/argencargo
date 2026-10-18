// /api/argenmaq/studio/imagen?d=<json en base64url> — dibuja una imagen del Content Studio de ARGENMAQ.
// Historias 1080×1920, publicaciones 1080×1350. Siempre con la foto real de la máquina: nada generado.
// Corre en el borde (satori): solo flex, nada de grid; cada div con varios hijos lleva display:flex.
import { ImageResponse } from "next/og";

export const runtime = "edge";

const Y = "#FFD200", K = "#15171A", G = "#9DA3A9", BL = "#FFFFFF";
// Las rutas tienen que ser literales: así el empaquetador incluye las fuentes en el despliegue.
const fuenteReg = fetch(new URL("../../../../argenmaq/_fonts/Montserrat-Regular.ttf", import.meta.url)).then((r) => r.arrayBuffer());
const fuenteSemi = fetch(new URL("../../../../argenmaq/_fonts/Montserrat-SemiBold.ttf", import.meta.url)).then((r) => r.arrayBuffer());
const fuenteExtra = fetch(new URL("../../../../argenmaq/_fonts/Montserrat-ExtraBold.ttf", import.meta.url)).then((r) => r.arrayBuffer());
const fmt = (v) => `USD ${Math.round(Number(v || 0)).toLocaleString("es-AR")}`;
const corta = (t, n) => { const s = String(t || "").replace(/\s*·\s*[A-Z0-9-]{3,}\s*$/, ""); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const decodificar = (b64) => { const s = b64.replace(/-/g, "+").replace(/_/g, "/"); const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4)); const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); return JSON.parse(new TextDecoder().decode(bytes)); };

// ── Piezas comunes ───────────────────────────────────────────────────────────
// Fondo de las piezas oscuras: un degradé suave (la grilla con dos gradientes tumbaba el dibujado).
const Grilla = () => <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundImage: "linear-gradient(180deg, #202327 0%, #15171A 75%, #15171A 100%)" }} />;
// Sobre fondo amarillo el "MAQ" amarillo del logo se pierde: ahí va dentro de una pastilla negra.
const Logo = ({ o, claro, h = 64 }) => <div style={{ display: "flex", alignItems: "center", ...(claro ? { background: K, borderRadius: 999, padding: "12px 26px 12px 16px" } : {}) }}>
  <img src={`${o}/argenmaq/isotipo-blanco.png`} height={claro ? h * 0.8 : h} style={{ height: claro ? h * 0.8 : h }} />
  <img src={`${o}/argenmaq/texto-blanco.png`} height={claro ? h * 0.4 : h * 0.5} style={{ height: claro ? h * 0.4 : h * 0.5, marginLeft: 16 }} />
</div>;
const Etq = ({ children, fondo = Y, color = K, size = 22 }) => <div style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: fondo, color, fontSize: size, fontWeight: 600, letterSpacing: 2 }}>{children}</div>;
const FotoCard = ({ src, h, w = "100%", radio = 36 }) => <div style={{ display: "flex", width: w, height: h, borderRadius: radio, background: BL, overflow: "hidden", alignItems: "center", justifyContent: "center", padding: 24 }}>
  {src ? <img src={src} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ display: "flex", color: G, fontSize: 28 }}>Sin foto</div>}
</div>;
const Pie = ({ o, claro, texto }) => <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
  <div style={{ display: "flex", fontSize: 24, color: claro ? "rgba(21,23,26,0.6)" : G, letterSpacing: 1 }}>{texto}</div>
  <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: claro ? K : BL }}>argenmaq.vercel.app</div>
</div>;
const Cuotas = ({ d, claro }) => <div style={{ display: "flex", width: "100%" }}>
  <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "22px 26px", borderRadius: 24, background: Y, color: K, marginRight: 14 }}>
    <div style={{ display: "flex", fontSize: 20, letterSpacing: 2, fontWeight: 600 }}>1ª CUOTA · HOY</div>
    <div style={{ display: "flex", fontSize: 38, fontWeight: 800, marginTop: 6 }}>{fmt(d.cuota1)}</div>
  </div>
  <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "22px 26px", borderRadius: 24, background: claro ? "rgba(21,23,26,0.08)" : "#24272B", color: claro ? K : BL }}>
    <div style={{ display: "flex", fontSize: 20, letterSpacing: 2, fontWeight: 600, color: claro ? "rgba(21,23,26,0.6)" : G }}>2ª CUOTA · AL RECIBIR</div>
    <div style={{ display: "flex", fontSize: 38, fontWeight: 800, marginTop: 6 }}>{fmt(d.cuota2)}</div>
  </div>
</div>;
const Llega = ({ texto, claro }) => <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 600, color: claro ? K : BL }}>
  <div style={{ display: "flex", width: 16, height: 16, borderRadius: 999, background: "#2FBF5A", marginRight: 14 }} />{texto}
</div>;

// ── Historias (1080×1920) ────────────────────────────────────────────────────
const MaquinaDia = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "120px 72px 110px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} /><Etq>PRECIO FINAL</Etq></div>
  <div style={{ display: "flex", marginTop: 56 }}><FotoCard src={d.foto} h={780} /></div>
  <div style={{ display: "flex", fontSize: 44, fontWeight: 800, lineHeight: 1.15, marginTop: 44, letterSpacing: -1 }}>{corta(d.nombre, 64)}</div>
  <div style={{ display: "flex", fontSize: 22, color: G, letterSpacing: 3, marginTop: 30 }}>PUESTO EN TU NEGOCIO · FLETE Y ADUANA INCLUIDOS</div>
  <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: Y, letterSpacing: -4, lineHeight: 1, marginTop: 8 }}>{fmt(d.precio)}</div>
  <div style={{ display: "flex", marginTop: 32 }}><Cuotas d={d} /></div>
  <div style={{ display: "flex", marginTop: 30 }}><Llega texto="Puesta en tu negocio, llave en mano" /></div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} texto="TOCÁ EL LINK PARA VER LA FICHA" /></div>
</div>;

const CuantoSale = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "120px 72px 110px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro /><Etq fondo={K} color={Y}>¿CUÁNTO SALE?</Etq></div>
  <div style={{ display: "flex", marginTop: 56 }}><FotoCard src={d.foto} h={820} /></div>
  <div style={{ display: "flex", fontSize: 44, fontWeight: 800, lineHeight: 1.15, marginTop: 44, letterSpacing: -1 }}>{corta(d.nombre, 64)}</div>
  <div style={{ display: "flex", fontSize: 36, fontWeight: 600, lineHeight: 1.25, marginTop: 36, color: "rgba(21,23,26,0.8)" }}>¿Cuánto sale puesta en tu negocio, con flete, aduana y entrega incluidos?</div>
  <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
    <div style={{ display: "flex", padding: "22px 40px", borderRadius: 24, background: K, color: Y, fontSize: 72, fontWeight: 800, letterSpacing: 10 }}>USD ·····</div>
    <div style={{ display: "flex", fontSize: 30, fontWeight: 600, marginLeft: 30 }}>Deslizá →</div>
  </div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} claro texto="LA RESPUESTA, EN LA SIGUIENTE HISTORIA" /></div>
</div>;

const Ruta = ({ claro }) => <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}><div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: claro ? "rgba(21,23,26,0.6)" : G }}>ORIGEN</div><div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>China</div></div>
  <div style={{ display: "flex", flex: 1, alignItems: "center", margin: "0 34px" }}>
    <div style={{ display: "flex", flex: 1, height: 4, borderBottom: `4px dashed ${claro ? "rgba(21,23,26,0.35)" : "#5B6066"}` }} />
    <div style={{ display: "flex", width: 22, height: 22, borderRadius: 999, background: claro ? K : Y, marginLeft: -4 }} />
    <div style={{ display: "flex", flex: 1, height: 4, borderBottom: `4px dashed ${claro ? "rgba(21,23,26,0.35)" : "#5B6066"}` }} />
  </div>
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}><div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: claro ? "rgba(21,23,26,0.6)" : G }}>DESTINO</div><div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>Argentina</div></div>
</div>;

const EnViaje = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "120px 72px 110px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro /><Etq fondo={K} color={Y}>EN VIAJE</Etq></div>
  <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 0.98, letterSpacing: -4, marginTop: 70 }}>Salió de China.</div>
  <div style={{ display: "flex", fontSize: 40, fontWeight: 600, lineHeight: 1.2, marginTop: 24, color: "rgba(21,23,26,0.75)" }}>{corta(d.nombre, 70)}{d.qty > 1 ? ` × ${d.qty}` : ""}</div>
  <div style={{ display: "flex", marginTop: 50 }}><FotoCard src={d.foto} h={620} /></div>
  <div style={{ display: "flex", marginTop: 54 }}><Ruta claro /></div>
  <div style={{ display: "flex", marginTop: 44 }}><Llega texto="Seguro y seguimiento incluidos" claro /></div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} claro texto="FLETE · SEGURO · ADUANA · ENTREGA: NOSOTROS" /></div>
</div>;

const Llego = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "120px 72px 110px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} /><Etq fondo="#2FBF5A" color={K}>ENTREGADA</Etq></div>
  <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 0.98, letterSpacing: -4, marginTop: 70 }}>Llegó.</div>
  <div style={{ display: "flex", fontSize: 40, fontWeight: 600, lineHeight: 1.2, marginTop: 24, color: G }}>{corta(d.nombre, 70)}{d.qty > 1 ? ` × ${d.qty}` : ""}</div>
  <div style={{ display: "flex", marginTop: 50 }}><FotoCard src={d.foto} h={700} /></div>
  <div style={{ display: "flex", fontSize: 40, fontWeight: 800, lineHeight: 1.2, marginTop: 54, color: Y }}>De la fábrica en China al negocio del cliente. Llave en mano.</div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} texto="¿CUÁL ES LA MÁQUINA QUE TE FALTA?" /></div>
</div>;

const Pedidos = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "120px 72px 110px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro /><Etq fondo={K} color={Y}>A PEDIDO</Etq></div>
  <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -3, marginTop: 70 }}>Esta semana nos pidieron:</div>
  <div style={{ display: "flex", flexDirection: "column", marginTop: 50 }}>
    {(d.items || []).map((t, i) => <div key={i} style={{ display: "flex", alignItems: "center", padding: "24px 30px", borderRadius: 22, background: K, color: BL, fontSize: 34, fontWeight: 600, marginBottom: 14 }}>
      <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: Y, marginRight: 22 }} />{t}
    </div>)}
    {d.total > (d.items || []).length && <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: "rgba(21,23,26,0.6)", marginTop: 6 }}>y {d.total - d.items.length} más.</div>}
  </div>
  <div style={{ display: "flex", fontSize: 40, fontWeight: 800, lineHeight: 1.2, marginTop: 60 }}>Si no está en el catálogo, la buscamos en fábrica y te pasamos el precio final puesto en tu negocio.</div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} claro texto="¿QUÉ MÁQUINA TE FALTA? ESCRIBINOS" /></div>
</div>;

// ── Publicaciones (1080×1350), sin precio ───────────────────────────────────
const Spec = ({ l, v }) => <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: 20, background: "#24272B", marginRight: 12, marginBottom: 12 }}>
  <div style={{ display: "flex", fontSize: 17, letterSpacing: 2, color: G }}>{l}</div><div style={{ display: "flex", fontSize: 26, fontWeight: 800, marginTop: 4 }}>{v}</div>
</div>;
const Ficha = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "64px 64px 56px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} h={56} /><Etq size={19}>{String(d.rubro || "MAQUINARIA").toUpperCase()}</Etq></div>
  <div style={{ display: "flex", marginTop: 40 }}><FotoCard src={d.foto} h={660} radio={32} /></div>
  <div style={{ display: "flex", fontSize: 42, fontWeight: 800, lineHeight: 1.15, marginTop: 36, letterSpacing: -1 }}>{corta(d.nombre, 64)}</div>
  <div style={{ display: "flex", flexWrap: "wrap", marginTop: 26 }}>
    {d.medidas?.[0] && <Spec l="MEDIDAS" v={d.medidas[0]} />}
    {d.medidas?.[1] && <Spec l="PESO" v={d.medidas[1]} />}
    {d.garantia && <Spec l="GARANTÍA" v={`${d.garantia} meses`} />}
    <Spec l="TENSIÓN" v="220 V · 50 Hz" />
  </div>
  <div style={{ display: "flex", marginTop: "auto", alignItems: "center", justifyContent: "space-between", padding: "22px 28px", borderRadius: 24, background: Y, color: K }}>
    <div style={{ display: "flex", fontSize: 26, fontWeight: 800 }}>Importada llave en mano. Puesta en tu negocio.</div>
    <div style={{ display: "flex", fontSize: 20, fontWeight: 600 }}>Consultá el precio →</div>
  </div>
</div>;

const Rubro = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "64px 64px 56px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro h={56} /><Etq fondo={K} color={Y} size={19}>CATÁLOGO</Etq></div>
  <div style={{ display: "flex", fontSize: 66, fontWeight: 800, lineHeight: 1, letterSpacing: -2, marginTop: 44 }}>3 máquinas para {String(d.rubro || "").toLowerCase()}.</div>
  <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
    {(d.maquinas || []).slice(0, 3).map((m, i) => <div key={i} style={{ display: "flex", alignItems: "center", background: BL, borderRadius: 28, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", width: 220, height: 220, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", background: "#F4F5F7" }}>{m.foto && <img src={m.foto} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}</div>
      <div style={{ display: "flex", flexDirection: "column", marginLeft: 30, flex: 1 }}>
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: G }}>0{i + 1}</div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 800, lineHeight: 1.15, marginTop: 6 }}>{corta(m.nombre, 58)}</div>
      </div>
    </div>)}
  </div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} claro texto="PRECIO FINAL PUESTO EN TU NEGOCIO · EN DOS CUOTAS" /></div>
</div>;


// ── Historias con más personalidad ──────────────────────────────────────────
const Nueva = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "120px 72px 110px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro /><Etq fondo={K} color={Y}>RECIÉN LLEGADA AL CATÁLOGO</Etq></div>
  <div style={{ display: "flex", fontSize: 110, fontWeight: 800, lineHeight: 0.95, letterSpacing: -5, marginTop: 64 }}>Nueva.</div>
  <div style={{ display: "flex", marginTop: 44 }}><FotoCard src={d.foto} h={760} /></div>
  <div style={{ display: "flex", fontSize: 44, fontWeight: 800, lineHeight: 1.15, marginTop: 40, letterSpacing: -1 }}>{corta(d.nombre, 64)}</div>
  <div style={{ display: "flex", alignItems: "baseline", marginTop: 26 }}>
    <div style={{ display: "flex", fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{fmt(d.precio)}</div>
    <div style={{ display: "flex", fontSize: 26, fontWeight: 600, marginLeft: 22, color: "rgba(21,23,26,0.7)" }}>puesta en tu negocio · en dos cuotas</div>
  </div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} claro texto="TOCÁ EL LINK PARA VER LA FICHA" /></div>
</div>;

const Opcion = ({ letra, m }) => <div style={{ display: "flex", flexDirection: "column", flex: 1, background: BL, borderRadius: 32, padding: 22, color: K }}>
  <div style={{ display: "flex", width: 64, height: 64, borderRadius: 999, background: K, color: Y, fontSize: 34, fontWeight: 800, alignItems: "center", justifyContent: "center" }}>{letra}</div>
  <div style={{ display: "flex", width: "100%", height: 400, alignItems: "center", justifyContent: "center", marginTop: 16, overflow: "hidden" }}>{m.foto && <img src={m.foto} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}</div>
  <div style={{ display: "flex", fontSize: 26, fontWeight: 700, lineHeight: 1.2, marginTop: 14, height: 94, overflow: "hidden" }}>{corta(m.nombre, 56)}</div>
  <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: -1, marginTop: 10 }}>{fmt(m.precio)}</div>
</div>;
const CualElegis = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "120px 72px 110px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} /><Etq>{String(d.rubro || "").toUpperCase()}</Etq></div>
  <div style={{ display: "flex", fontSize: 96, fontWeight: 800, lineHeight: 0.98, letterSpacing: -4, marginTop: 64 }}>¿Cuál elegís?</div>
  <div style={{ display: "flex", marginTop: 50, width: "100%" }}><Opcion letra="A" m={d.a || {}} /><div style={{ display: "flex", width: 22 }} /><Opcion letra="B" m={d.b || {}} /></div>
  <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: G, marginTop: 40, lineHeight: 1.3 }}>Las dos con precio final puesto en tu negocio, en dos cuotas.</div>
  <div style={{ display: "flex", marginTop: "auto" }}><Pie o={o} texto="RESPONDÉ A O B" /></div>
</div>;

const Sabias = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "120px 72px 110px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} /><Etq>ASÍ TRABAJAMOS</Etq></div>
  <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
    <div style={{ display: "flex", width: 120, height: 14, borderRadius: 999, background: Y }} />
    <div style={{ display: "flex", fontSize: 108, fontWeight: 800, lineHeight: 0.98, letterSpacing: -5, marginTop: 44 }}>{d.titulo}</div>
    <div style={{ display: "flex", fontSize: 42, fontWeight: 600, lineHeight: 1.3, marginTop: 44, color: G }}>{d.bajada}</div>
  </div>
  <div style={{ display: "flex" }}><Pie o={o} texto="MAQUINARIA LLAVE EN MANO" /></div>
</div>;

// ── Placas de carrusel (1080×1350), sin precio ──────────────────────────────
const Portada = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "64px 64px 56px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} h={56} /><Etq size={19}>{String(d.rubro || "MAQUINARIA").toUpperCase()}</Etq></div>
  <div style={{ display: "flex", marginTop: 40 }}><FotoCard src={d.foto} h={800} radio={32} /></div>
  <div style={{ display: "flex", fontSize: 50, fontWeight: 800, lineHeight: 1.1, marginTop: 40, letterSpacing: -1.5 }}>{corta(d.nombre, 60)}</div>
  <div style={{ display: "flex", marginTop: "auto", alignItems: "center", justifyContent: "space-between" }}>
    <div style={{ display: "flex", fontSize: 24, fontWeight: 600, color: G }}>Importada llave en mano. Puesta en tu negocio.</div>
    <div style={{ display: "flex", fontSize: 22, fontWeight: 700, color: Y }}>Deslizá →</div>
  </div>
</div>;
const Fila = ({ l, v }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "26px 0", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
  <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: G }}>{l}</div><div style={{ display: "flex", fontSize: 38, fontWeight: 800, textAlign: "right" }}>{v}</div>
</div>;
const Specs = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "64px 64px 56px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} h={56} /><Etq size={19}>DATOS</Etq></div>
  <div style={{ display: "flex", alignItems: "center", marginTop: 44 }}>
    <div style={{ display: "flex", width: 260, height: 260, borderRadius: 28, background: BL, overflow: "hidden", alignItems: "center", justifyContent: "center", padding: 14 }}>{d.foto && <img src={d.foto} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}</div>
    <div style={{ display: "flex", fontSize: 40, fontWeight: 800, lineHeight: 1.12, marginLeft: 34, flex: 1, letterSpacing: -1 }}>{corta(d.nombre, 64)}</div>
  </div>
  <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
    {d.medidas?.[0] && <Fila l="MEDIDAS" v={d.medidas[0]} />}
    {d.medidas?.[1] && <Fila l="PESO" v={d.medidas[1]} />}
    {d.subrubro && <Fila l="TIPO" v={corta(d.subrubro, 28)} />}
    {d.garantia && <Fila l="GARANTÍA" v={`${d.garantia} meses de fábrica`} />}
    <Fila l="TENSIÓN" v="220 V · 50 Hz" />
    <Fila l="ORIGEN" v="Fábrica en China" />
  </div>
  <div style={{ display: "flex", marginTop: "auto", fontSize: 24, fontWeight: 600, color: G }}>Consultá el precio final puesto en tu negocio, en dos cuotas.</div>
</div>;
const Incluye = ({ o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "64px 64px 56px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro h={56} /><Etq fondo={K} color={Y} size={19}>LLAVE EN MANO</Etq></div>
  <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -3, marginTop: 50 }}>El precio final incluye:</div>
  <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
    {["La máquina, de fábrica", "Flete internacional", "Seguro de la carga", "Despacho de aduana", "Entrega en tu negocio", "Pago en dos cuotas"].map((t, i) => <div key={i} style={{ display: "flex", alignItems: "center", padding: "22px 28px", borderRadius: 22, background: K, color: BL, fontSize: 36, fontWeight: 700, marginBottom: 14 }}>
      <div style={{ display: "flex", width: 18, height: 18, borderRadius: 999, background: Y, marginRight: 24 }} />{t}
    </div>)}
  </div>
  <div style={{ display: "flex", marginTop: "auto", fontSize: 26, fontWeight: 700 }}>Sin trámites de aduana. De eso nos ocupamos nosotros.</div>
</div>;
const RubroPortada = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: Y, color: K, padding: "64px 64px 56px", position: "relative" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} claro h={56} /><Etq fondo={K} color={Y} size={19}>CATÁLOGO</Etq></div>
  <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center" }}>
    <div style={{ display: "flex", fontSize: 240, fontWeight: 800, lineHeight: 0.9, letterSpacing: -12 }}>{d.n}</div>
    <div style={{ display: "flex", fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -3, marginTop: 20 }}>máquinas para {String(d.rubro || "").toLowerCase()}.</div>
    <div style={{ display: "flex", fontSize: 34, fontWeight: 600, marginTop: 40, color: "rgba(21,23,26,0.7)" }}>Importadas llave en mano, puestas en tu negocio.</div>
  </div>
  <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 26, fontWeight: 800 }}>Deslizá →</div>
</div>;
const RubroItem = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, padding: "64px 64px 56px", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} h={56} /><Etq size={19}>{`${d.i} / ${d.n}`}</Etq></div>
  <div style={{ display: "flex", marginTop: 40 }}><FotoCard src={d.foto} h={820} radio={32} /></div>
  <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: G, marginTop: 40 }}>{String(d.sub || "").toUpperCase()}</div>
  <div style={{ display: "flex", fontSize: 46, fontWeight: 800, lineHeight: 1.1, marginTop: 12, letterSpacing: -1.5 }}>{corta(d.nombre, 60)}</div>
  <div style={{ display: "flex", marginTop: "auto", fontSize: 24, fontWeight: 600, color: G }}>Consultá el precio final puesto en tu negocio.</div>
</div>;

// ── Historias destacadas (1080×1920): foto de fondo + un título + una bajada. Sin precio, sin CTA, sin plazos.
// d.foto = escena de fondo (o nada: fondo negro liso), d.paso = número opcional, d.titulo, d.bajada, d.logoArg = logo apilado de Argencargo en lugar de foto.
const Destacada = ({ d, o }) => <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: K, color: BL, position: "relative" }}>
  {d.foto ? <img src={d.foto} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Grilla />}
  {d.foto && <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundImage: "linear-gradient(180deg, rgba(21,23,26,0.55) 0%, rgba(21,23,26,0.15) 35%, rgba(21,23,26,0.55) 62%, rgba(21,23,26,0.96) 100%)" }} />}
  <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "120px 72px 150px", position: "relative" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Logo o={o} />{d.etiqueta && <Etq>{String(d.etiqueta).toUpperCase()}</Etq>}</div>
    {d.logoArg && <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}><img src={`${o}/argencargo/logo-apilado-blanco.png`} style={{ width: 520 }} /></div>}
    {d.pantalla && <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "center", marginTop: 40 }}><div style={{ display: "flex", width: 560, height: 820, borderRadius: 48, overflow: "hidden", border: "10px solid #2A2D31", background: "#0D0F11" }}><img src={d.pantalla} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} /></div></div>}
    <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
      {d.paso && <div style={{ display: "flex", alignItems: "center", marginBottom: 22 }}><div style={{ display: "flex", width: 76, height: 76, borderRadius: 999, background: Y, color: K, fontSize: 40, fontWeight: 800, alignItems: "center", justifyContent: "center" }}>{d.paso}</div>{d.de && <div style={{ display: "flex", marginLeft: 18, fontSize: 24, letterSpacing: 3, color: G }}>DE {d.de}</div>}</div>}
      <div style={{ display: "flex", fontSize: d.titulo && d.titulo.length > 34 ? 66 : 78, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{d.titulo}</div>
      {d.bajada && <div style={{ display: "flex", fontSize: 34, fontWeight: 600, lineHeight: 1.3, marginTop: 26, color: d.foto ? "rgba(255,255,255,0.9)" : G }}>{d.bajada}</div>}
    </div>
  </div>
</div>;

// Tapa de destacada (1080×1080): pictograma amarillo sobre negro, sin texto. Instagram la recorta en círculo.
const ICONOS = {
  pasos: <svg width="520" height="520" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 19.5h4v-4h4v-4h4v-4h4" /><path d="M16.5 4.5l2.5 3-2.5 3" /></svg>,
  lupa: <svg width="520" height="520" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></svg>,
  engranaje: <svg width="520" height="520" viewBox="0 0 24 24" fill="none" stroke={Y} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /><circle cx="12" cy="12" r="7" /></svg>,
  avion: <svg width="520" height="520" viewBox="0 0 24 24" fill={Y} stroke={Y} strokeWidth="0.8" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>,
};
const Tapa = ({ d }) => <div style={{ display: "flex", width: "100%", height: "100%", background: K, alignItems: "center", justifyContent: "center", position: "relative" }}>
  <Grilla />
  <div style={{ display: "flex", position: "relative" }}>{ICONOS[d.icono] || ICONOS.pasos}</div>
</div>;

const PLANTILLAS = { maquina_dia: MaquinaDia, cuanto_sale: CuantoSale, en_viaje: EnViaje, llego: Llego, pedidos: Pedidos, ficha: Ficha, rubro: Rubro, destacada: Destacada, tapa: Tapa, nueva: Nueva, cual_elegis: CualElegis, sabias: Sabias, portada: Portada, specs: Specs, incluye: Incluye, rubro_portada: RubroPortada, rubro_item: RubroItem };
const TAMANOS = { ficha: [1080, 1350], rubro: [1080, 1350], portada: [1080, 1350], specs: [1080, 1350], incluye: [1080, 1350], rubro_portada: [1080, 1350], rubro_item: [1080, 1350], tapa: [1080, 1080] };

export async function GET(req) {
  const u = new URL(req.url);
  let d; try { d = decodificar(u.searchParams.get("d") || ""); } catch { return new Response("Datos inválidos", { status: 400 }); }
  const Pl = PLANTILLAS[d.p]; if (!Pl) return new Response("Plantilla desconocida", { status: 400 });
  const [w, h] = TAMANOS[d.p] || [1080, 1920];
  const [reg, semi, extra] = await Promise.all([fuenteReg, fuenteSemi, fuenteExtra]);
  const o = u.origin;
  return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", fontFamily: "Montserrat" }}><Pl d={d} o={o} /></div>, {
    width: w, height: h,
    fonts: [{ name: "Montserrat", data: reg, weight: 400 }, { name: "Montserrat", data: semi, weight: 600 }, { name: "Montserrat", data: extra, weight: 800 }],
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
