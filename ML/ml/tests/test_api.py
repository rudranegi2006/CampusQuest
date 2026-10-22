from __future__ import annotations

from io import BytesIO
import unittest

from PIL import Image

try:
    from fastapi.testclient import TestClient
    from ml.service.app import create_app
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False


class FakeEngine:
    def predict(self, image_bytes):
        return {"predictedTerritory": "Library", "accepted": True, "similarity": 0.8,
                "margin": 0.2, "predictions": [{"label": "Library", "similarity": 0.8}]}


def jpeg_bytes():
    out = BytesIO()
    Image.new("RGB", (64, 64), "navy").save(out, "JPEG")
    return out.getvalue()


@unittest.skipUnless(FASTAPI_AVAILABLE, "Install requirements-test.txt to run API tests")
class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(create_app(engine=FakeEngine(), api_token="test-secret", max_image_bytes=1024))
        self.headers = {"Authorization": "Bearer test-secret", "Content-Type": "image/jpeg"}

    def tearDown(self):
        self.client.close()

    def test_health_readiness_and_authenticated_prediction(self):
        self.assertEqual(self.client.get("/healthz").status_code, 200)
        self.assertEqual(self.client.get("/readyz").status_code, 200)
        response = self.client.post("/v1/predict", content=jpeg_bytes(), headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["predictedTerritory"], "Library")

    def test_authentication_is_required(self):
        response = self.client.post("/v1/predict", content=jpeg_bytes(), headers={"Content-Type": "image/jpeg"})
        self.assertEqual(response.status_code, 401)

    def test_bad_media_and_invalid_bytes_are_rejected(self):
        wrong_type = self.client.post("/v1/predict", content=b"x", headers={**self.headers, "Content-Type": "text/plain"})
        self.assertEqual(wrong_type.status_code, 415)
        invalid = self.client.post("/v1/predict", content=b"not image", headers=self.headers)
        self.assertEqual(invalid.status_code, 422)

    def test_large_upload_is_rejected(self):
        client = TestClient(create_app(engine=FakeEngine(), api_token="test-secret", max_image_bytes=8))
        response = client.post("/v1/predict", content=b"x" * 9, headers=self.headers)
        self.assertEqual(response.status_code, 413)
        client.close()


if __name__ == "__main__":
    unittest.main()
