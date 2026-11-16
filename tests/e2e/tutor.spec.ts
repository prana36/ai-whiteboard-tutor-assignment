import { test, expect } from "@playwright/test";
import { sampleLesson } from "../../lib/sample";

// Synthetic PCM audio keeps transport tests deterministic and does not call paid APIs.
function wav(seconds = 2) {
  const size = 8000 * seconds * 2;
  const data = Buffer.alloc(44 + size);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + size, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(8000, 24);
  data.writeUInt32LE(16000, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(size, 40);
  return data;
}

test("sample, deterministic seeking, annotations, quiz, export, and saved history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What will you understand today?" }),
  ).toBeVisible();
  await expect(page.getByText("Checking tutor connection…")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/lumio-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Or explore a sample lesson" }).click();
  await expect(page.getByRole("heading", { name: sampleLesson.title, exact: true })).toBeVisible();
  await expect(page.getByText("Browser voice · estimated timeline", { exact: true })).toBeVisible();
  const board = page.getByRole("img", { name: "Whiteboard: Learning from examples" });
  await expect(board).toBeVisible();
  await expect(board.locator(".board-element")).toHaveCount(2);
  await page.getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(page.getByRole("img", { name: "Whiteboard: Meet a single neuron" })).toBeVisible();
  await page.getByRole("button", { name: "Previous chapter", exact: true }).click();
  await expect(board).toBeVisible();
  const slider = page.getByRole("slider", { name: "Seek lesson" });
  await slider.focus();
  await slider.press("End");
  await expect(
    page.getByRole("img", { name: "Whiteboard: Learning that generalizes" }),
  ).toBeVisible();
  await slider.press("Home");
  await expect(board).toBeVisible();
  await page.getByRole("button", { name: "Pen tool", exact: true }).click();
  const box = (await board.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 150, { steps: 10 });
  await page.mouse.up();
  await expect(board.locator("polyline")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo last drawing" }).click();
  await expect(board.locator("polyline")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download whiteboard", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("lumio-whiteboard.svg");
  await page.getByRole("button", { name: "Select tool", exact: true }).click();
  await board.locator(".board-element").filter({ hasText: "Picture → numbers" }).click();
  await expect(page.getByRole("textbox", { name: "Follow-up question" })).toHaveValue(
    /Picture → numbers/,
  );
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  await page
    .getByRole("button", { name: /Build a network/ })
    .last()
    .click();
  await expect(slider).not.toHaveValue("0");
  await page.getByRole("button", { name: "Check my understanding" }).click();
  await page
    .getByRole("button", { name: /To check whether it learned patterns that generalize/ })
    .click();
  await expect(page.getByText("That's it. You've connected the dots!")).toBeVisible();
  await page.getByRole("button", { name: "My lessons" }).click();
  await expect(page.getByRole("heading", { name: "A shelf full of discoveries." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "My lessons" }).click();
  await expect(page.getByRole("heading", { name: sampleLesson.title })).toBeVisible();
  expect(errors).toEqual([]);
});

test("AI transport: generation, real audio clock, pause, seek, restart, follow-up context", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { configured: true, accessCodeRequired: false } }),
  );
  await page.route("**/api/lesson", (route) =>
    route.fulfill({ json: { ...sampleLesson, source: "ai", id: "test-generated" } }),
  );
  await page.route("**/api/speech", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav() }),
  );
  let chatPayload: { context: string; question: string } | undefined;
  await page.route("**/api/chat", (route) => {
    chatPayload = route.request().postDataJSON();
    return route.fulfill({
      json: { answer: "A weight controls how strongly an input affects a neuron's output." },
    });
  });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Lesson topic" }).fill("How neural networks learn");
  await page.getByRole("button", { name: "Generate lesson" }).click();
  await expect(page.getByRole("heading", { name: sampleLesson.title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Prepare AI voice", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play lesson", exact: true })).toBeEnabled({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Play lesson", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Seek lesson" });
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0.25);
  await page.getByRole("button", { name: "Pause lesson", exact: true }).click();
  const pausedAt = Number(await slider.inputValue());
  await page.waitForTimeout(400);
  expect(Number(await slider.inputValue())).toBeCloseTo(pausedAt, 1);
  await page.getByRole("button", { name: "Next chapter", exact: true }).click();
  await expect(page.getByRole("img", { name: "Whiteboard: Meet a single neuron" })).toBeVisible();
  await page.getByRole("button", { name: "Play lesson", exact: true }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(2.2);
  await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  await expect(slider).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Play lesson", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mute narration" }).click();
  await expect(page.getByRole("button", { name: "Unmute narration" })).toBeVisible();
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("1.5");
  await page.getByRole("button", { name: "Play lesson", exact: true }).click();
  await expect(page.getByRole("img", { name: "Whiteboard: Meet a single neuron" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  await page.getByRole("textbox", { name: "Follow-up question" }).fill("What is a weight?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    page.getByText("A weight controls how strongly an input affects a neuron's output."),
  ).toBeVisible();
  expect(chatPayload?.question).toBe("What is a weight?");
  expect(chatPayload?.context).toContain("Currently viewing scene 1");
  expect(chatPayload?.context).toContain("backpropagation".replace("b", "B"));
});

test("API failure is visible and preserves the learner's input", async ({ page }) => {
  await page.route("**/api/lesson", (route) =>
    route.fulfill({ status: 503, json: { error: "AI is not configured for this test." } }),
  );
  await page.goto("/");
  await page.getByRole("textbox", { name: "Lesson topic" }).fill("Gravity");
  await page.getByRole("button", { name: "Generate lesson" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "AI is not configured" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Lesson topic" })).toHaveValue("Gravity");
  await expect(page.getByRole("button", { name: "Generate lesson" })).toBeEnabled();
});

test("mobile: chat to board, playback, settings, and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Or explore a sample lesson" }).click();
  await expect(page.getByRole("img", { name: "Whiteboard: Learning from examples" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: "artifacts/lumio-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Follow-up question" })).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open saved lessons" }).click();
  await expect(page.getByRole("heading", { name: "A shelf full of discoveries." })).toBeVisible();
  await page.getByRole("button", { name: "Start a new lesson" }).click();
  await expect(page.getByRole("textbox", { name: "Lesson topic" })).toBeVisible();
});
