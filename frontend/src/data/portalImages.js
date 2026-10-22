// SAMPLE portal images, used ONLY when a portal has no uploaded reference image.
// Replace later with real photos: either upload them through the admin API (then this file is ignored),
// or drop files into /public/portals/ and point the names below at them, e.g. "/portals/library.jpg".
//
// The defaults below are Amity Noida campus photos hot-linked from a third-party gallery
// (collegechalo.com). They are placeholders only: they work while online, are not ours to
// redistribute, and can disappear at any time.
const GALLERY = "https://web-collegechalo.s3.ap-south-1.amazonaws.com/colleges/amity-university-noida/gallery";
const PLACEHOLDERS = [1, 2, 3, 4, 5, 6].map((n) => `${GALLERY}/${n}.webp`);

// Per-portal overrides (by portal name). Anything not listed gets a stable placeholder.
export const PORTAL_IMAGES = {
  // "Library": "/portals/library.jpg",
};

function stableIndex(key, mod) {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % mod;
}

export function sampleImageFor(portal) {
  return PORTAL_IMAGES[portal.name] || PLACEHOLDERS[stableIndex(portal.name ?? portal.id, PLACEHOLDERS.length)];
}
