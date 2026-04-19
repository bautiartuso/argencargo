// API route para traer reseñas de Google Places.
// Setear en Vercel:
//   GOOGLE_PLACES_API_KEY    — API key del proyecto de Google Cloud (Places API habilitada)
//   GOOGLE_PLACE_ID          — Place ID de Argencargo (sacar desde developers.google.com/maps/documentation/places/web-service/place-id)
//
// Uso: GET /api/reviews
// Respuesta: { rating, total, reviews: [{ author, rating, text, time, photo }] }
// Caché server-side de 24h para no quemar el free tier (Places cobra por cada Place Details call).

const PLACE_ID = process.env.GOOGLE_PLACE_ID;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Caché simple in-memory (vive mientras la lambda esté tibia — ~5-15 min en Vercel).
// Para caché real de 24h usar Supabase o Vercel KV. Por ahora alcanza.
let cached = null;

export async function GET() {
  if (!PLACE_ID || !API_KEY) {
    return Response.json({
      error: "missing_config",
      message: "Setear GOOGLE_PLACE_ID y GOOGLE_PLACES_API_KEY en env vars.",
      fallback: true,
      // Datos dummy para que el landing no rompa mientras no esté configurado
      rating: null,
      total: 0,
      reviews: []
    }, { status: 200 });
  }

  // Caché de 24h
  if (cached && Date.now() - cached.at < 24 * 3600 * 1000) {
    return Response.json(cached.data);
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=rating,user_ratings_total,reviews&language=es&key=${API_KEY}`;
    const r = await fetch(url, { next: { revalidate: 86400 } });
    const j = await r.json();

    if (j.status !== "OK") {
      return Response.json({ error: j.status, message: j.error_message || "Places API error" }, { status: 500 });
    }

    const result = {
      rating: j.result?.rating || null,
      total: j.result?.user_ratings_total || 0,
      reviews: (j.result?.reviews || []).map(rv => ({
        author: rv.author_name,
        rating: rv.rating,
        text: rv.text,
        time: rv.time ? new Date(rv.time * 1000).toISOString() : null,
        relativeTime: rv.relative_time_description,
        photo: rv.profile_photo_url || null,
        language: rv.language || null
      }))
    };

    cached = { at: Date.now(), data: result };
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: "fetch_failed", message: e.message }, { status: 500 });
  }
}
