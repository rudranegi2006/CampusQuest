#!/bin/sh
set -eu

if [ "${AUTO_BUILD_GALLERY:-true}" = "true" ] && [ ! -f "${GALLERY_PATH:-/data/gallery.npz}" ]; then
  echo "Gallery not found. Building it from bundled campus reference photos..."
  python -m ml.build_gallery \
    --photos "${PHOTOS_DIR:-/app/photos}" \
    --output "${GALLERY_PATH:-/data/gallery.npz}" \
    --exclude-file "${GALLERY_EXCLUDE_FILE:-/app/config/gallery_exclude.txt}"
fi

exec uvicorn ml.service.app:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
