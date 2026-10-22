import { useEffect, useState } from "react";

const MAX_ACCURACY_M = 100; // ignore very rough fixes (cell/wifi guesses)

/**
 * Live device position via watchPosition().
 *
 * PWA reality: browsers stop delivering GPS updates once the app is backgrounded
 * or the screen locks, so we deliberately stop the watch when the page is hidden
 * (saves battery) and start it again when the app comes back to the foreground.
 *
 * status: "idle" | "searching" | "active" | "denied" | "unsupported"
 */
export default function useUserLocation({ enabled = true } = {}) {
  const [position, setPosition] = useState(null); // { lng, lat, accuracy, heading }
  const [status, setStatus] = useState(() =>
    typeof navigator !== "undefined" && "geolocation" in navigator ? "idle" : "unsupported",
  );

  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;

    let watchId = null;
    let permission = null;

    const onOk = (pos) => {
      const { longitude, latitude, accuracy, heading } = pos.coords;
      if (accuracy > MAX_ACCURACY_M) {
        setStatus("searching");
        return;
      }
      setStatus("active");
      setPosition({
        lng: longitude,
        lat: latitude,
        accuracy,
        heading: Number.isFinite(heading) ? heading : null,
      });
    };

    const onErr = (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        setStatus("denied");
        stop();
      } else {
        setStatus("searching"); // timeout / unavailable: the watch keeps retrying
      }
    };

    const start = () => {
      if (watchId !== null) return;
      setStatus((s) => (s === "active" ? s : "searching"));
      watchId = navigator.geolocation.watchPosition(onOk, onErr, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 15000,
      });
    };

    const stop = () => {
      if (watchId === null) return;
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);

    // If the user flips the permission in system settings while the app is open.
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        permission = p;
        p.onchange = () => {
          if (p.state === "granted" && !document.hidden) start();
          if (p.state === "denied") setStatus("denied");
        };
      })
      .catch(() => {});

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      if (permission) permission.onchange = null;
    };
  }, [enabled]);

  return { position, status };
}
