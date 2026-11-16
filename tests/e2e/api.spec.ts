import { test, expect } from "@playwright/test";

test("API status contains capability flags without revealing credentials", async ({ request }) => {
  const response = await request.get("/api/status");
  expect(response.status()).toBe(200);
  const status = await response.json();
  expect(Object.keys(status).sort()).toEqual(["accessCodeRequired", "configured"]);
  expect(typeof status.configured).toBe("boolean");
  expect(typeof status.accessCodeRequired).toBe("boolean");
});

test("real route rejects bad inputs and explains missing provider configuration", async ({
  request,
}) => {
  const status = await (await request.get("/api/status")).json();
  test.skip(
    status.accessCodeRequired,
    "An access code is configured; API guard coverage is in unit tests.",
  );
  const invalid = await request.post("/api/lesson", { data: { topic: " " } });
  expect(invalid.status()).toBe(400);
  const oversized = await request.post("/api/chat", { data: "x".repeat(70_000) });
  expect(oversized.status()).toBe(413);
  if (!status.configured) {
    const missing = await request.post("/api/lesson", { data: { topic: "The water cycle" } });
    expect(missing.status()).toBe(503);
    expect((await missing.json()).error).toContain("OPENAI_API_KEY");
  }
});
