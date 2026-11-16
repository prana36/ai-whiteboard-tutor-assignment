import { z } from "zod";
import { CHAT_PROMPT } from "@/lib/prompts";
import { apiError, getAI, guard, HttpError, readBody } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    guard(request, "chat", 35);
    const body = await readBody(
      request,
      z.object({
        question: z.string().trim().min(2).max(1000),
        context: z.string().max(14000),
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(12),
      }),
    );
    const result = await getAI().responses.create(
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: [
          { role: "system", content: CHAT_PROMPT },
          { role: "user", content: `Lesson context:\n${body.context}` },
          ...body.messages,
          { role: "user", content: body.question },
        ],
        max_output_tokens: 700,
        store: false,
      },
      { signal: request.signal },
    );
    if (!result.output_text)
      throw new HttpError(422, "The tutor couldn't answer that. Try rephrasing your question.");
    return Response.json(
      { answer: result.output_text },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
