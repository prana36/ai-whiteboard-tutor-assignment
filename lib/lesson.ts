import { z } from "zod";

export const elementSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(["rect", "ellipse", "text", "arrow", "line"]),
  x: z.number().min(0).max(960),
  y: z.number().min(0).max(500),
  width: z.number().min(-900).max(900),
  height: z.number().min(-480).max(480),
  text: z.string().max(100),
  color: z.enum(["ink", "purple", "green", "orange", "blue"]),
  reveal: z.number().min(0).max(0.9),
});

export const sceneSchema = z.object({
  title: z.string().min(1).max(70),
  narration: z.string().min(40).max(1600),
  takeaway: z.string().min(1).max(180),
  elements: z.array(elementSchema).min(2).max(16),
});

export const lessonContentSchema = z.object({
  title: z.string().min(1).max(90),
  summary: z.string().min(1).max(300),
  scenes: z.array(sceneSchema).min(4).max(7),
  suggestions: z.array(z.string().min(1).max(100)).min(2).max(3),
  quiz: z.object({
    question: z.string().min(1).max(220),
    options: z.array(z.string().min(1).max(140)).length(3),
    answerIndex: z.number().int().min(0).max(2),
    explanation: z.string().min(1).max(350),
  }),
});

export const lessonSchema = lessonContentSchema.extend({
  id: z.string().min(1).max(80),
  source: z.enum(["ai", "sample"]),
  createdAt: z.string(),
});

export type BoardElement = z.infer<typeof elementSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type ChatMessage = { role: "user" | "assistant"; content: string };

export function estimateDuration(text: string): number {
  return Math.max(8, (text.trim().split(/\s+/).length / 135) * 60);
}

export function timeline(durations: number[]) {
  let total = 0;
  const starts = durations.map((duration) => {
    const start = total;
    total += duration;
    return start;
  });
  return { starts, total };
}

export function locateTime(time: number, durations: number[]) {
  const { starts, total } = timeline(durations);
  const clamped = Math.max(0, Math.min(time, total));
  let index = durations.length - 1;
  for (let i = 0; i < durations.length; i++) {
    if (clamped < starts[i] + durations[i]) {
      index = i;
      break;
    }
  }
  return {
    index,
    offset: clamped - starts[index],
    progress: durations[index] ? (clamped - starts[index]) / durations[index] : 0,
  };
}

export function visibleElements(scene: Scene, progress: number) {
  return scene.elements.filter((element) => element.reveal <= progress + 0.001);
}

export function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
