import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { lessonContentSchema } from "@/lib/lesson";
import { LESSON_PROMPT } from "@/lib/prompts";
import { apiError, getAI, guard, HttpError, readBody } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    guard(request, "lesson", 12);
    const { topic } = await readBody(
      request,
      z.object({ topic: z.string().trim().min(3).max(240) }),
    );
    const result = await getAI().responses.parse(
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: [
          { role: "system", content: LESSON_PROMPT },
          { role: "user", content: topic },
        ],
        text: { format: zodTextFormat(lessonContentSchema, "whiteboard_lesson") },
        max_output_tokens: 6500,
        store: false,
      },
      { signal: request.signal },
    );
    if (!result.output_parsed)
      throw new HttpError(
        422,
        "The tutor couldn't create a lesson for this topic. Try a specific educational topic.",
      );
    const content = lessonContentSchema.parse(result.output_parsed);
    // Clamp generated geometry to the board and disambiguate repeated IDs.
    content.scenes.forEach((scene) =>
      scene.elements.forEach((element, i) => {
        element.id = `element-${i}`;
        if (element.kind === "rect" || element.kind === "ellipse") {
          element.x = Math.min(element.x, 910);
          element.width = Math.max(60, Math.min(Math.abs(element.width), 970 - element.x));
          element.height = Math.max(45, Math.min(Math.abs(element.height), 550 - element.y));
        } else if (element.kind === "arrow" || element.kind === "line") {
          element.width = Math.max(20 - element.x, Math.min(element.width, 980 - element.x));
          element.height = Math.max(20 - element.y, Math.min(element.height, 540 - element.y));
        }
      }),
    );
    return Response.json(
      { ...content, id: crypto.randomUUID(), source: "ai", createdAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
