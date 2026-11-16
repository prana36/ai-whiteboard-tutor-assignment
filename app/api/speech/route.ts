import { z } from "zod";
import { apiError, getAI, guard, readBody } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    guard(request, "speech", 90);
    const { text } = await readBody(
      request,
      z.object({ text: z.string().trim().min(1).max(1600) }),
    );
    const audio = await getAI().audio.speech.create(
      {
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: "coral",
        input: text,
        response_format: "mp3",
        speed: 0.95,
      },
      { signal: request.signal },
    );
    return new Response(await audio.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
