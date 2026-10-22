// Local territory photos, served from frontend/public/territories/.
// Keyed by portal name (must match the `name` column in backend/db/seeds/001_portals_riddles.sql).
// No internet fetching: if a portal isn't listed here, the app falls back to the image uploaded
// through the admin API (image_url), and if there is none the image is simply omitted.
const BASE = "/territories";

export const PORTAL_IMAGES = {
  "H Block Centre": `${BASE}/h-block-centre.png`,
  "Helipad": `${BASE}/helipad.png`,
  "Palm Court": `${BASE}/palm-court.png`,
  "Sports Complex Room": `${BASE}/sports-complex-room.png`,
  "N Block Coffee": `${BASE}/n-block-coffee.png`,
  "Library": `${BASE}/library.png`,
  "Gate No. 2": `${BASE}/gate-no-2.png`,
  "I Block Mess": `${BASE}/i-block-mess.png`,
  "Megabyte": `${BASE}/megabyte.png`,
  "Rara's Food Truck": `${BASE}/raras-food-truck.png`,
  "Arcadia Pickleball Court": `${BASE}/arcadia-pickleball-court.png`,
  "Cafedia": `${BASE}/cafedia.png`,
  "J2 Block Entrance": `${BASE}/j2-block-entrance.png`,
  "Hidden Fruit Shop": `${BASE}/hidden-fruit-shop.png`,
  "The Bank": `${BASE}/the-bank.png`,
};

/** Local image path for a portal, or null when we don't have one. */
export function localImageFor(portal) {
  return PORTAL_IMAGES[portal?.name] || null;
}