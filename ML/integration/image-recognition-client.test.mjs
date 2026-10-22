import test from "node:test";
import assert from "node:assert/strict";
import { createImageRecognitionClient, ImageRecognitionError } from "./image-recognition-client.mjs";

test("sends raw image bytes with the private bearer credential", async () => {
  const client = createImageRecognitionClient({
    baseUrl: "http://recognizer:8000/",
    token: "backend-secret",
    fetchImpl: async (url, options) => {
      assert.equal(url.href, "http://recognizer:8000/v1/predict");
      assert.equal(options.headers.authorization, "Bearer backend-secret");
      assert.equal(options.headers["content-type"], "image/png");
      assert.deepEqual(options.body, Buffer.from("image"));
      return Response.json({ predictedTerritory: "Library", accepted: true, similarity: 0.8, margin: 0.2, predictions: [] });
    },
  });
  const result = await client.recognize(Buffer.from("image"), { contentType: "image/png" });
  assert.equal(result.predictedTerritory, "Library");
});

test("rejects missing configuration and unsupported uploads locally", async () => {
  assert.throws(() => createImageRecognitionClient({ baseUrl: "http://x" }), /TOKEN/);
  const client = createImageRecognitionClient({ baseUrl: "http://x", token: "secret" });
  await assert.rejects(() => client.recognize(Buffer.from("x"), { contentType: "text/plain" }), TypeError);
});

test("maps service errors without hiding their status or code", async () => {
  const client = createImageRecognitionClient({
    baseUrl: "http://x",
    token: "secret",
    fetchImpl: async () => Response.json({ error: { code: "unauthorized", message: "Denied" } }, { status: 401 }),
  });
  await assert.rejects(() => client.recognize(Buffer.from("x")), (error) => {
    assert.ok(error instanceof ImageRecognitionError);
    assert.equal(error.status, 401);
    assert.equal(error.code, "unauthorized");
    return true;
  });
});
