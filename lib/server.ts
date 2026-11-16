import OpenAI from "openai";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new HttpError(
      503,
      "Add OPENAI_API_KEY to .env.local (or your hosting environment) and restart the server to enable the AI tutor. You can explore the sample lesson now.",
    );
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 80_000, maxRetries: 1 });
}

// Best-effort per-instance protection. Use a shared gateway/rate limiter for a large public deployment.
const buckets = new Map<string, { count: number; reset: number }>();
export function guard(request: Request, route: string, limit: number) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "This request must come from the tutor application.");
  const code = process.env.TUTOR_ACCESS_CODE;
  if (code && request.headers.get("x-tutor-access-code") !== code)
    throw new HttpError(401, "Enter the demo access code in Settings to use the AI tutor.");
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.reset < now) buckets.delete(key);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${route}:${ip}`;
  const bucket = buckets.get(key) || { count: 0, reset: now + 600_000 };
  if (++bucket.count > limit)
    throw new HttpError(429, "You've reached the request limit. Please try again in 10 minutes.");
  buckets.set(key, bucket);
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 65_536) {
      await reader.cancel();
      throw new HttpError(413, "Your request is too large.");
    }
    chunks.push(value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new HttpError(400, "Please check your input and try again.");
  }
}

export function apiError(error: unknown) {
  let status = 500;
  let message = "The tutor couldn't complete this request. Please try again.";
  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof OpenAI.APIError) {
    status = error.status === 429 ? 429 : 502;
    message =
      error.status === 401
        ? "The server's OpenAI API key is invalid. Check your environment configuration."
        : error.status === 429
          ? "The AI provider's quota or rate limit was reached. Check API billing or try again shortly."
          : "The AI service is temporarily unavailable. Please try again.";
  }
  // Log metadata only; provider error bodies may contain submitted content.
  console.error("Tutor request failed", {
    name: error instanceof Error ? error.name : "Unknown",
    status,
  });
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
