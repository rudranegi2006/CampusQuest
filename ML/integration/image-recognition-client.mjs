const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImageRecognitionError extends Error {
  constructor(message, { status = 0, code = "inference_error" } = {}) {
    super(message);
    this.name = "ImageRecognitionError";
    this.status = status;
    this.code = code;
  }
}

/** Create a backend-only client for the private image-recognition service. */
export function createImageRecognitionClient({
  baseUrl = process.env.IMAGE_RECOGNITION_URL,
  token = process.env.IMAGE_RECOGNITION_TOKEN,
  timeoutMs = 5000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!baseUrl) throw new Error("IMAGE_RECOGNITION_URL is required");
  if (!token) throw new Error("IMAGE_RECOGNITION_TOKEN is required");
  if (typeof fetchImpl !== "function") throw new Error("A Fetch API implementation is required");
  const url = new URL("/v1/predict", baseUrl);
  if (!(["http:", "https:"].includes(url.protocol))) throw new Error("Inference URL must use HTTP or HTTPS");

  return {
    async recognize(imageBytes, { contentType = "image/jpeg" } = {}) {
      if (!Buffer.isBuffer(imageBytes) || imageBytes.length === 0) {
        throw new TypeError("imageBytes must be a non-empty Buffer");
      }
      if (!SUPPORTED_TYPES.has(contentType.toLowerCase())) {
        throw new TypeError("contentType must be image/jpeg, image/png, or image/webp");
      }
      let response;
      try {
        response = await fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": contentType.toLowerCase(),
          },
          body: imageBytes,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (cause) {
        throw new ImageRecognitionError("Image recognition service could not be reached", { code: "service_unavailable" });
      }
      let body;
      try {
        body = await response.json();
      } catch {
        throw new ImageRecognitionError("Image recognition service returned an invalid response", {
          status: response.status,
          code: "invalid_service_response",
        });
      }
      if (!response.ok) {
        const error = body?.error ?? {};
        throw new ImageRecognitionError(error.message ?? "Image recognition request failed", {
          status: response.status,
          code: error.code ?? "inference_error",
        });
      }
      if (typeof body?.accepted !== "boolean" || !Array.isArray(body?.predictions)) {
        throw new ImageRecognitionError("Image recognition service returned an invalid response", {
          status: response.status,
          code: "invalid_service_response",
        });
      }
      return body;
    },
  };
}
