import { Marker } from "maplibre-gl";

const STYLE_ID = "cq-user-marker-style";
const GLIDE_MS = 800;

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes cq-user-pulse {
      0%   { transform: scale(0.6); opacity: .55; }
      100% { transform: scale(2.6); opacity: 0; }
    }
    .cq-user { position: relative; width: 18px; height: 18px; pointer-events: none; transition: opacity .35s ease; }
    .cq-user-acc { position: absolute; left: 50%; top: 50%; border-radius: 50%; transform: translate(-50%, -50%);
      background: rgba(59,130,246,.14); border: 1px solid rgba(59,130,246,.35); }
    .cq-user-pulse { position: absolute; inset: 0; border-radius: 50%; background: rgba(59,130,246,.55);
      animation: cq-user-pulse 2s ease-out infinite; }
    .cq-user-dot { position: absolute; inset: 0; border-radius: 50%; background: #3b82f6; border: 3px solid #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,.15), 0 2px 8px rgba(59,130,246,.7); box-sizing: border-box; }
    @media (prefers-reduced-motion: reduce) { .cq-user-pulse { animation: none; opacity: .25; } }
  `;
  document.head.appendChild(style);
}

// Metres covered by one CSS pixel at this latitude/zoom (MapLibre uses 512px tiles).
const metersPerPixel = (lat, zoom) =>
  (78271.51696 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);

/**
 * "You are here" marker: blue dot + pulse + accuracy circle. Glides between GPS fixes.
 * Returns { update({lng,lat,accuracy}), hide(), remove() }.
 */
export function createUserMarker(map) {
  injectStyle();

  // MapLibre owns the transform of the outer element, so style a CHILD.
  const wrapper = document.createElement("div");
  wrapper.style.pointerEvents = "none";
  const root = document.createElement("div");
  root.className = "cq-user";
  root.style.opacity = "0";
  root.innerHTML =
    '<div class="cq-user-acc"></div><div class="cq-user-pulse"></div><div class="cq-user-dot"></div>';
  wrapper.appendChild(root);
  const ring = root.querySelector(".cq-user-acc");

  const marker = new Marker({ element: wrapper, anchor: "center" });
  let added = false;
  let current = null; // lng/lat currently drawn
  let accuracy = 0;
  let raf = null;

  const sizeRing = () => {
    if (!current) return;
    const px = Math.min(accuracy, 60) / metersPerPixel(current.lat, map.getZoom());
    const d = Math.max(px * 2, 0);
    ring.style.width = ring.style.height = `${d}px`;
    ring.style.display = d < 24 ? "none" : "block"; // hide when smaller than the dot
  };
  map.on("zoom", sizeRing);

  const glideTo = (target) => {
    cancelAnimationFrame(raf);
    const from = { ...current };
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / GLIDE_MS, 1);
      const e = 1 - Math.pow(1 - k, 3); // ease-out
      current = {
        lng: from.lng + (target.lng - from.lng) * e,
        lat: from.lat + (target.lat - from.lat) * e,
      };
      marker.setLngLat([current.lng, current.lat]);
      sizeRing();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  return {
    update({ lng, lat, accuracy: acc }) {
      accuracy = acc ?? 0;
      if (!added) {
        current = { lng, lat };
        marker.setLngLat([lng, lat]).addTo(map);
        added = true;
      } else {
        glideTo({ lng, lat });
      }
      sizeRing();
      requestAnimationFrame(() => (root.style.opacity = "1"));
    },
    hide() {
      root.style.opacity = "0";
      cancelAnimationFrame(raf);
      if (added) {
        marker.remove();
        added = false;
        current = null;
      }
    },
    remove() {
      cancelAnimationFrame(raf);
      map.off("zoom", sizeRing);
      marker.remove();
    },
  };
}
