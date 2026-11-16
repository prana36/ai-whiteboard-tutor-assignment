import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateDuration,
  formatTime,
  lessonSchema,
  locateTime,
  timeline,
  visibleElements,
} from "../lib/lesson";
import { sampleLesson } from "../lib/sample";

test("sample lesson meets the same validated contract as live AI lessons", () => {
  assert.equal(lessonSchema.safeParse(sampleLesson).success, true);
  for (const scene of sampleLesson.scenes) {
    assert.equal(new Set(scene.elements.map((element) => element.id)).size, scene.elements.length);
    for (const element of scene.elements) {
      if (
        element.kind === "rect" ||
        element.kind === "ellipse" ||
        element.kind === "arrow" ||
        element.kind === "line"
      ) {
        assert.ok(element.x + element.width <= 1000 && element.x + element.width >= 0);
        assert.ok(element.y + element.height <= 560 && element.y + element.height >= 0);
      }
    }
  }
});

test("timeline maps backward and forward seeks deterministically", () => {
  const durations = [18.2, 20.5, 17.8];
  assert.deepEqual(timeline(durations), { starts: [0, 18.2, 38.7], total: 56.5 });
  assert.deepEqual(locateTime(28.45, durations), { index: 1, offset: 10.25, progress: 0.5 });
  assert.deepEqual(locateTime(-10, durations), { index: 0, offset: 0, progress: 0 });
  const end = locateTime(9999, durations);
  assert.equal(end.index, 2);
  assert.ok(Math.abs(end.progress - 1) < 0.000001);
  assert.equal(locateTime(0, durations).index, 0);
});

test("exact scene boundaries display the next scene", () => {
  assert.equal(locateTime(10, [10, 20]).index, 1);
  assert.equal(locateTime(9.99, [10, 20]).index, 0);
  assert.equal(locateTime(30, [10, 20]).index, 1);
});

test("rewinding removes later board elements instead of retaining stale drawings", () => {
  const scene = sampleLesson.scenes[0];
  assert.equal(visibleElements(scene, 1).length, scene.elements.length);
  assert.ok(visibleElements(scene, 0).length < scene.elements.length);
  assert.deepEqual(
    visibleElements(scene, 0),
    scene.elements.filter((element) => element.reveal === 0),
  );
});

test("estimates and timestamps remain usable for empty or short narration", () => {
  assert.equal(estimateDuration("Hello"), 8);
  assert.equal(formatTime(125.9), "2:05");
  assert.equal(formatTime(-10), "0:00");
});

test("malformed and oversized generated content is rejected", () => {
  assert.equal(lessonSchema.safeParse({ ...sampleLesson, scenes: [] }).success, false);
  assert.equal(
    lessonSchema.safeParse({ ...sampleLesson, quiz: { ...sampleLesson.quiz, answerIndex: 5 } })
      .success,
    false,
  );
  const bad = structuredClone(sampleLesson);
  bad.scenes[0].elements[0].x = 100_000;
  assert.equal(lessonSchema.safeParse(bad).success, false);
});
