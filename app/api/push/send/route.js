// POST /api/push/send — envía Web Push a todas las suscripciones de un user_id
// Body: { user_id, title, body, url }
// Server-only (usa SERVICE_ROLE). Llamado desde otros endpoints internos.

import crypto from "crypto";

const SB_URL = "https://nhfslvixhlbiyfmedmbr.supabase.co";
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@argencargo.com.ar";

export const maxDuration = 15;

// --- Helpers base64url ---
const b64uEncode = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uDecode = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
};

// --- ECDH key import ---
function importPrivateKey(b64u) {
  const d = b64uDecode(b64u);
  // P-256 raw private key → EC PRIVATE KEY DER
  // Build PKCS8 manually
  const pubFromPriv = crypto.createECDH("prime256v1");
  pubFromPriv.setPrivateKey(d);
  const publicKey = pubFromPriv.getPublicKey(); // 04 || X || Y
  return { d, publicKey };
}

function importP256Public(b64u) {
  const raw = b64uDecode(b64u); // 65 bytes 0x04|X|Y
  return raw;
}

// --- HKDF ---
function hkdf(salt, ikm, info, length) {
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  let t = Buffer.alloc(0), okm = Buffer.alloc(0), counter = 1;
  while (okm.length < length) {
    t = crypto.createHmac("sha256", prk).update(Buffer.concat([t, info, Buffer.from([counter])])).digest();
    okm = Buffer.concat([okm, t]);
    counter++;
  }
  return okm.slice(0, length);
}

// --- Encrypt payload with aes128gcm content-encoding (RFC 8291) ---
function encryptPayload(payload, p256dhB64, authB64) {
  const userPublic = importP256Public(p256dhB64); // 65 bytes
  const userAuth = b64uDecode(authB64);

  // Generate ephemeral keypair
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const senderPublic = ecdh.getPublicKey(); // 65 bytes
  const sharedSecret = ecdh.computeSecret(userPublic);

  const salt = crypto.randomBytes(16);

  // PRK_key = HKDF-Expand(HKDF-Extract(auth, ECDH), key_info, 32)
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    userPublic,
    senderPublic,
  ]);
  const ikm = hkdf(userAuth, sharedSecret, keyInfo, 32);

  // CEK = HKDF(salt, IKM, "Content-Encoding: aes128gcm\0", 16)
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  // Nonce = HKDF(salt, IKM, "Content-Encoding: nonce\0", 12)
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Pad payload: payload || 0x02 (last record marker)
  const padded = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([0x02])]);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(padded), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const body = Buffer.concat([ciphertext, authTag]);

  // aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid (senderPublic 65)
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const idlen = Buffer.from([senderPublic.length]);
  const header = Buffer.concat([salt, rs, idlen, senderPublic]);

  return { body: Buffer.concat([header, body]) };
}

// --- VAPID JWT (ES256) ---
function vapidJwt(audience) {
  const header = b64uEncode(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64uEncode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  }));
  const signingInput = `${header}.${payload}`;

  // Build EC PRIVATE KEY in DER from raw 32-byte private + public
  const privBytes = b64uDecode(VAPID_PRIVATE);
  const pubBytes = b64uDecode(VAPID_PUBLIC);
  // SEC1 ECPrivateKey: 30 77 02 01 01 04 20 <priv> A0 0A 06 08 2A 86 48 CE 3D 03 01 07 A1 44 03 42 00 <pub>
  const der = Buffer.concat([
    Buffer.from("30770201010420", "hex"),
    privBytes,
    Buffer.from("a00a06082a8648ce3d030107a14403420004", "hex"),
    pubBytes.slice(1), // strip the 0x04 prefix; the DER format already includes 0x04 at the end of the prefix
  ]);
  const pem = "-----BEGIN EC PRIVATE KEY-----\n" + der.toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END EC PRIVATE KEY-----\n";
  const sig = crypto.createSign("SHA256").update(signingInput).sign({ key: pem, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64uEncode(sig)}`;
}

async function sendOne(sub, title, body, url) {
  const payload = JSON.stringify({ title, body, url });
  const encrypted = encryptPayload(payload, sub.p256dh, sub.auth);
  const audience = new URL(sub.endpoint).origin;
  const jwt = vapidJwt(audience);

  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encrypted.body,
  });
  return { status: r.status, endpoint: sub.endpoint };
}

export async function POST(req) {
  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return Response.json({ ok: false, error: "VAPID keys not configured" }, { status: 500 });
    }
    const { user_id, title, body, url } = await req.json();
    if (!user_id || !title) return Response.json({ ok: false, error: "missing fields" }, { status: 400 });

    const subsR = await fetch(`${SB_URL}/rest/v1/push_subscriptions?user_id=eq.${user_id}&select=*`, {
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
    });
    const subs = await subsR.json();
    if (!Array.isArray(subs) || subs.length === 0) {
      return Response.json({ ok: true, skipped: "no_subscriptions" });
    }

    const results = [];
    for (const s of subs) {
      try {
        const r = await sendOne(s, title, body, url);
        results.push(r);
        // Si el endpoint reporta gone (404/410), borrarlo
        if (r.status === 404 || r.status === 410) {
          await fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, {
            method: "DELETE",
            headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` },
          });
        }
      } catch (e) {
        results.push({ status: "error", error: e.message, endpoint: s.endpoint });
      }
    }
    return Response.json({ ok: true, sent: results.filter(r => r.status >= 200 && r.status < 300).length, results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
