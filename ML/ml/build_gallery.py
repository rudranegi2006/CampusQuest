"""Build reference embeddings from photos/<territory>/ into an NPZ gallery."""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from embedding import create_encoder, embed_images, save_gallery

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def excluded_paths(exclude_file: Path | None) -> set[str]:
    if not exclude_file or not exclude_file.is_file():
        return set()
    return {
        line.strip().replace("\\", "/")
        for line in exclude_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }


def collect_paths(photos_dir: Path, exclusions: set[str]) -> list[Path]:
    candidates = sorted(p for p in photos_dir.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS)
    chosen = []
    for path in candidates:
        rel = path.relative_to(photos_dir).as_posix()
        if rel not in exclusions:
            chosen.append(path)
    return chosen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--photos", type=Path, default=ROOT / "photos")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "gallery.npz")
    parser.add_argument("--exclude-file", type=Path, default=ROOT / "config" / "gallery_exclude.txt")
    parser.add_argument("--weights", default="imagenet", help="Keras weights argument; 'imagenet' downloads pretrained weights")
    args = parser.parse_args()
    if not args.photos.is_dir():
        raise SystemExit(f"Photo directory not found: {args.photos}")
    excluded = excluded_paths(args.exclude_file)
    paths = collect_paths(args.photos, excluded)
    if not paths:
        raise SystemExit("No reference images found after applying exclusions.")
    labels = [p.parent.name for p in paths]
    counts = Counter(labels)
    print(f"Embedding {len(paths)} reference photos across {len(counts)} populated territories.")
    for label, count in sorted(counts.items()):
        print(f"  {label}: {count}")
    if excluded:
        print(f"Excluded {len(excluded)} listed path(s); confirm this list matches your intended game labels.")
    print("Loading EfficientNetV2B0 ImageNet weights; first run needs internet access.")
    model = create_encoder(weights=args.weights)
    gallery = {"embeddings": embed_images(model, paths),
               "labels": np.asarray(labels),
               "paths": [str(p) for p in paths]}
    save_gallery(gallery, args.output)
    manifest = {
        "encoder": "EfficientNetV2B0",
        "weights": args.weights,
        "image_size": 224,
        "reference_count": len(paths),
        "territory_counts": dict(sorted(counts.items())),
        "excluded_paths": sorted(excluded),
        "source_directory": str(args.photos),
    }
    args.output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Gallery saved to {args.output}")


if __name__ == "__main__":
    main()
