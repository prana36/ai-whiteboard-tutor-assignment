import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { guard, HttpError, readBody } from "../lib/server";

test("request validation rejects malformed JSON and invalid topics", async () => {
  const schema = z.object({ topic: z.string().trim().min(3).max(240) });
  const request = (body: string) =>
    new Request("https://lumio.test/api/lesson", { method: "POST", body });
  await assert.rejects(
    readBody(request("not json"), schema),
    (error: unknown) => error instanceof HttpError && error.status === 400,
  );
  await assert.rejects(
    readBody(request('{"topic":"  "}'), schema),
    (error: unknown) => error instanceof HttpError && error.status === 400,
  );
  assert.deepEqual(await readBody(request('{"topic":"  Gravity  "}'), schema), {
    topic: "Gravity",
  });
});

test("oversized request bodies are rejected before parsing", async () => {
  const request = new Request("https://lumio.test/api/chat", {
    method: "POST",
    body: "x".repeat(70_000),
  });
  await assert.rejects(
    readBody(request, z.any()),
    (error: unknown) => error instanceof HttpError && error.status === 413,
  );
});

test("cross-origin calls are denied", () => {
  const request = new Request("https://lumio.test/api/lesson", {
    headers: { origin: "https://other.test" },
  });
  assert.throws(
    () => guard(request, "origin-test", 2),
    (error: unknown) => error instanceof HttpError && error.status === 403,
  );
});

test("request budget is enforced per route", () => {
  const request = new Request("https://lumio.test/api/lesson");
  guard(request, "budget-test", 2);
  guard(request, "budget-test", 2);
  assert.throws(
    () => guard(request, "budget-test", 2),
    (error: unknown) => error instanceof HttpError && error.status === 429,
  );
  assert.doesNotThrow(() => guard(request, "other-test", 2));
});

test("optional access code rejects missing and incorrect credentials", () => {
  const previous = process.env.TUTOR_ACCESS_CODE;
  process.env.TUTOR_ACCESS_CODE = "test-code";
  try {
    const request = (code?: string) =>
      new Request("https://lumio.test/api/lesson", {
        headers: code ? { "x-tutor-access-code": code } : {},
      });
    assert.throws(
      () => guard(request(), "code-test", 2),
      (error: unknown) => error instanceof HttpError && error.status === 401,
    );
    assert.throws(() => guard(request("incorrect"), "code-test", 2));
    assert.doesNotThrow(() => guard(request("test-code"), "code-test", 2));
  } finally {
    if (previous === undefined) delete process.env.TUTOR_ACCESS_CODE;
    else process.env.TUTOR_ACCESS_CODE = previous;
  }
});
