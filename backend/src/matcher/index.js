// Image-recognition adapter.
//   compareImages({ photo: Buffer, contentType, portal }) -> { similarity: 0..1, label, matches }
//
//   similarity  confidence the photo shows THIS portal (0 if the portal is not among the model's top guesses)
//   label       the model's best guess (highest similarity) for the photo
//   matches     true when that best guess is this portal
//
// The decision (matches && similarity >= IMAGE_MATCH_THRESHOLD) is made in resonatorService.
import { env } from '../config/env.js';
import { httpError } from '../lib/errors.js';

// ML labels come from photo folder names ("Raras Foodtruck", "Bank"), portals from the DB
// ("Rara's Food Truck", "The Bank"). Compare them ignoring case, punctuation, spaces and a leading "The".
export const normalizeName = (s) =>
  String(s ?? '').toLowerCase().replace(/^\s*the\s+/, '').replace(/[^a-z0-9]/g, '');

async function mockCompare({ portal }) {
  return { similarity: env.MATCHER_MOCK_SIMILARITY, label: portal?.name ?? null, matches: true };
}

// HTTP contract (ML/README.md):
//   POST {IMAGE_MATCHER_URL}/v1/predict   Authorization: Bearer <token>   Content-Type: image/*   body = raw image bytes
//   -> 200 { predictedTerritory, accepted, similarity, margin, predictions: [{ label, similarity }] }
// The service's own `accepted` / `predictedTerritory` verdict is ignored on purpose: the game decides
// from the highest-similarity prediction and IMAGE_MATCH_THRESHOLD.
async function httpCompare({ photo, contentType = 'image/jpeg', portal }) {
  if (!env.IMAGE_MATCHER_URL || !env.IMAGE_MATCHER_TOKEN) throw httpError(503, 'Image matcher is not configured');
  const url = new URL('/v1/predict', env.IMAGE_MATCHER_URL);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.IMAGE_MATCHER_TOKEN}`, 'content-type': contentType },
      body: photo,
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw httpError(503, 'Image matcher is unavailable');
  }
  if (!res.ok) throw httpError(503, 'Image matcher failed');

  let body;
  try { body = await res.json(); } catch { throw httpError(503, 'Image matcher returned an invalid response'); }

  const predictions = (Array.isArray(body?.predictions) ? body.predictions : [])
    .map((p) => ({ label: String(p?.label ?? ''), similarity: Number(p?.similarity) }))
    .filter((p) => p.label && Number.isFinite(p.similarity))
    .sort((a, b) => b.similarity - a.similarity);              // don't trust the service's ordering
  if (!predictions.length) throw httpError(503, 'Image matcher returned no predictions');

  const clamp = (n) => Math.min(1, Math.max(0, n));
  const top = predictions[0];
  const wanted = normalizeName(portal.name);
  const own = predictions.find((p) => normalizeName(p.label) === wanted);
  return {
    similarity: own ? clamp(own.similarity) : 0,
    label: top.label,
    matches: normalizeName(top.label) === wanted,
  };
}

export const matcherMode = env.IMAGE_MATCHER;
export const compareImages = env.IMAGE_MATCHER === 'http' ? httpCompare : mockCompare;
