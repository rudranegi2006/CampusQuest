# CampusQuest Image Recognition Product

This ZIP contains a separately runnable, authenticated image-recognition service and a Node.js ES module client adapter. The service predicts which **populated reference-photo territory** best matches an uploaded image. It does not authenticate players, check GPS, grant resonators, score the game, deploy to a territory, or make any final game decision.

## Important: game backend was not present in the supplied workspace

I inspected the accessible project. It contains the photo dataset and an ML helper/notebook, but **no Node/Fastify application, PostgreSQL schema, Firebase setup, or existing Docker Compose configuration**. I therefore could not edit or test actual game routes, preserve backend rules in code, or wire image recognition into the real deployment. The ZIP provides the Python service and a tested Node client adapter for that integration point. A project owner or developer with the backend files must call the adapter from the existing authenticated photo flow and pass the result into the existing game-rule decision.

The game backend must remain authoritative. Only call the service after the game has authenticated the player and validated the upload/session. Combine its result with GPS and current game rules. Never let an image response alone approve a deployment. Old photos, screenshots, spoofed GPS, and visually similar locations can fool this model.

## What the supplied dataset contains

The reference set has 26 photos in 8 populated folders: H Block Centre (5), Helipad (5), Gate 2A (4), Library (3), Bank (3), Megabyte (2), Raras Foodtruck (2), and Sports Complex Room (2). The other territory folders and `_other` are empty. No missing class or negative example is invented.

Three visibly problematic reference photos are excluded by default in `config/gallery_exclude.txt`:

- `H Block Centre/H_Block_Centre_01.jpg` is a three-panel collage.
- `Bank/Bank_02.jpg` shows HDFC Bank, while the other two Bank photos show Indian Bank.
- `Helipad/Helipad_05.jpg` is a text-bearing aerial/screenshot-like image unlike the other references.

That leaves 23 references. The quality issues and small counts mean this is a prototype, not a validated recognition product. Similarity and margin are ranking signals, not real-world probabilities. There is no meaningful held-out accuracy estimate: capture sessions are not labelled, each class has only 2–5 photos, and `_other` has zero examples. Collect 15–20 genuine varied phone photos per territory over at least two sessions and keep a future session entirely out of gallery building. Collect 30+ varied campus-negative examples for `_other`; even that will not cover every unknown location.

The ZIP includes these provided campus reference photos because they are required to generate a working gallery. Review and replace them if they should not be distributed. Do not upload personal/identifying images. Generated gallery embeddings are kept in a Docker volume and are not included in the ZIP.

## Run locally with Docker

Requirements: Docker Desktop with Docker Compose, and internet access on the first start to download EfficientNetV2B0 ImageNet weights. The model weights and built gallery are not bundled. The first container startup builds the gallery from the bundled photos and persists it in the `gallery-data` volume; later startups reuse it.

1. Extract `CampusQuest_ImageRecognition_Product.zip`.
2. In the extracted folder, copy `.env.example` to `.env`.
3. Replace `INFERENCE_API_TOKEN` with a long random secret. On Windows PowerShell, generate one with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Keep it only in backend/service configuration; never send it to a player.
4. Start the service from that folder:

   ```powershell
   docker compose up --build -d
   ```

5. Wait for gallery generation and check readiness:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8000/healthz
   Invoke-RestMethod http://127.0.0.1:8000/readyz
   ```

   `/healthz` is a liveness check. `/readyz` returns HTTP 200 only when a gallery/model and API token are configured. On first startup, watch progress with `docker compose logs -f`.

6. Test a photo (use the exact token value from `.env`):

   ```powershell
   curl.exe -X POST "http://127.0.0.1:8000/v1/predict" `
     -H "Authorization: Bearer YOUR_TOKEN_HERE" `
     -H "Content-Type: image/jpeg" `
     --data-binary "@photos/Library/Library_01.jpg"
   ```

   A response contains `predictedTerritory` (or `null` when rejected), `accepted`, `similarity`, `margin`, and up to three `{label, similarity}` predictions. This example photo is in the gallery, so it demonstrates the API only; it is not a held-out performance test.

To stop the service, run `docker compose down`. To rebuild the gallery after changing references, run `docker compose down`, then `docker compose run --rm --entrypoint python campusquest-recognition -m ml.build_gallery --photos /app/photos --output /data/gallery.npz --exclude-file /app/config/gallery_exclude.txt`, then `docker compose up -d`. To force a full gallery rebuild, remove the `gallery-data` volume only if you intentionally want to discard the generated embeddings; the source photos are separate.

## API

`POST /v1/predict` accepts **raw image bytes** (not multipart form data) with `Content-Type: image/jpeg`, `image/png`, or `image/webp` and an `Authorization: Bearer <secret>` header. Maximum upload is 8 MiB by default; the decoded image must be at most 20 megapixels. The service checks token, media type, image decode, file size, and image dimensions. It returns structured JSON and does not log image bytes.

Example accepted result:

```json
{
  "predictedTerritory": "Library",
  "accepted": true,
  "similarity": 0.82,
  "margin": 0.14,
  "predictions": [
    {"label": "Library", "similarity": 0.82},
    {"label": "H Block Centre", "similarity": 0.68},
    {"label": "Helipad", "similarity": 0.41}
  ]
}
```

Values above are illustrative. The implementation never hardcodes prediction values. If the score or separation is insufficient, `accepted` is false and `predictedTerritory` is `null`. Default score/margin thresholds are configurable in `.env`, but they are **unvalidated starting values**, not calibrated confidence cutoffs. Calibrate using independent target photos and realistic negative images before use.

## Connect the existing Node/Fastify backend

`integration/image-recognition-client.mjs` is a dependency-free ES module for Node.js 18+. Configure the existing backend with:

- `IMAGE_RECOGNITION_URL=http://127.0.0.1:8000` when Node runs on the same host; or the recognition service's private Docker DNS name when both containers share a Docker network.
- `IMAGE_RECOGNITION_TOKEN` equal to the service's `INFERENCE_API_TOKEN`.

Use it inside the existing authenticated, validated photo route. For a Node process on the host:

```js
import { createImageRecognitionClient } from "./integration/image-recognition-client.mjs";

const imageRecognition = createImageRecognitionClient();
// Inside your existing authenticated and game-session-validated flow:
const visualSignal = await imageRecognition.recognize(imageBuffer, { contentType: "image/jpeg" });
// Pass visualSignal into existing server-side game rules together with GPS/session data.
// The existing game service, not this client or ML service, decides deployment.
```

When the backend runs in a separate container, attach it and this service to a shared private Docker network and use the recognition container DNS name. Do not expose the inference port publicly or pass its token to client apps. Add a timeout/failure policy in the existing backend; an unavailable model must not become an approval.

No Fastify route, Firebase Authentication middleware, GPS validation, territory API, or PostgreSQL migration is included, because none of those source files or contracts were available. The adapter has not been connected to or tested against your real game. Provide the backend project to implement and verify that final integration without guessing its game rules.

## Gallery updates

Add genuine photos to `photos/<Exact Territory Name>/`, clean the source labels, then rebuild the gallery. Empty directories do not create model classes. Review the exclusion manifest before changing it. Pretrained EfficientNetV2B0 is frozen; gallery updates do not retrain a neural network. The build script downloads ImageNet weights if they are not already cached and outputs `gallery.npz` plus a manifest. Do not mix photos from different buildings in one label.

## Tests

Run tests locally with Python 3.11 and Node.js 18 or later:

```powershell
python -m pip install -r requirements-test.txt
python -m unittest discover -s ml/tests -v
node --test integration/image-recognition-client.test.mjs
```

The tests cover similarity acceptance/rejection, image byte/type/pixel limits, exclusion list behavior, API auth/readiness/upload validation, and the Node adapter contract. They do not test Firebase, GPS, database/game decisions, a real trained gallery, or held-out model accuracy because the CampusQuest backend and session-labelled evaluation data were not supplied.

## Troubleshooting

- **`/readyz` says gallery/model is missing:** inspect `docker compose logs -f`. First startup needs internet access to fetch model weights. Check disk space and the `gallery-data` volume.
- **401 from `/v1/predict`:** use `Authorization: Bearer <INFERENCE_API_TOKEN>` and verify the backend has the same secret.
- **415 or 422:** send raw JPEG/PNG/WebP bytes and the matching `Content-Type`; do not send multipart form data or a browser upload wrapper.
- **413:** reduce the image size or deliberately adjust `MAX_IMAGE_BYTES` / the pixel limit in service code.
- **Slow first start:** initial model download and gallery embedding are CPU/GPU dependent. Later starts reuse the volume.
- **Unknown/rejected output:** the current dataset is tiny, several territories are empty, and no `_other` negatives exist. Rejection is expected for uncertain images. Add clean real references and collect held-out examples before adjusting thresholds.
- **Recognition service unavailable from backend container:** `127.0.0.1` inside a container refers to that same container. Use the service DNS name on a shared private Docker network.
