# Lumio · AI Whiteboard Tutor

A chat-first tutor that turns a topic into a short narrated lesson, with diagrams that build on an interactive whiteboard as the explanation plays.

Built for the Braynix Studios assignment with **Next.js App Router, React, TypeScript, Node.js route handlers, and OpenAI**. The original brief is preserved in [docs/ASSIGNMENT.md](docs/ASSIGNMENT.md).

## Quick start

Prerequisites: **Node.js 22+**, npm, a modern browser, and an OpenAI API key with API billing enabled. A ChatGPT subscription does not supply API credits.

```bash
npm install
```

Create your environment file:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`, then:

```bash
npm run dev
```

Open **http://localhost:3000**. Enter a topic, generate a lesson, click **Prepare voice**, wait for narration preparation, then press **Play**. The second click respects browser autoplay policies. Focused topics such as “how binary search works” give the clearest two-minute lessons.

Without a key, **Explore a sample lesson** offers an explicitly labeled, pre-written neural-network lesson with browser narration. Arbitrary lesson generation and follow-up answers require the real API; sample content is never presented as live AI output.

## Environment variables

| Variable            | Required    | Purpose                                                     |
| ------------------- | ----------- | ----------------------------------------------------------- |
| `OPENAI_API_KEY`    | For live AI | Server-side OpenAI API key                                  |
| `OPENAI_MODEL`      | No          | Lesson/chat model; defaults to `gpt-4o-mini`                |
| `OPENAI_TTS_MODEL`  | No          | Speech model; defaults to `gpt-4o-mini-tts`                 |
| `TUTOR_ACCESS_CODE` | No          | Optional shared demo access code to control paid API access |

Restart the dev server after changes. Keys must never use the `NEXT_PUBLIC_` prefix. `.env.local` is ignored by Git. If you configure an access code, visitors enter it in Settings; it is kept in session storage and sent in a request header. Share the code with evaluators if enabled.

## Features

- Generate approximately two-minute lessons for educational topics using live AI.
- Validated lesson data: 4–7 scenes (the prompt targets 6), narration, timed diagrams, and chapter takeaways.
- Generated voice narration; actual audio time drives the whiteboard state.
- Play, pause, resume, seek, restart, replay, previous/next chapter, mute, and speed controls.
- Transcript chapters that seek the lesson when clicked.
- Pen, highlighter, undo, and SVG board export; scene-specific session annotations.
- Click diagram labels to compose contextual follow-up questions.
- Contextual AI answers with a bounded conversation history.
- A generated concept check with answer feedback.
- Last 12 lessons saved in this browser; searchable library and lesson JSON export.
- Responsive mobile tabs, keyboard-friendly inputs, reduced motion, native dialog focus management, and explicit loading/error/cancel states.

## Architecture

```text
Topic → POST /api/lesson → OpenAI structured output → Zod validation
                                                     ↓
                                           Typed lesson + scenes
                                                     ↓
Prepare voice → POST /api/speech (2 concurrent) → audio Blob URLs
                                                     ↓
                                     measured scene audio durations
                                                     ↓
                                   HTMLAudioElement.currentTime
                                                     ↓
                              absolute lesson time → scene + progress
                                                     ↓
                                 deterministic SVG element visibility

Follow-up + lesson + recent messages → POST /api/chat → AI answer
```

Next.js route handlers run on Node.js, so no separate Express server is needed. Credentials never enter client code. The browser uses same-origin API requests. Lesson/chat requests use `store: false`; this does not override the provider's data-retention policies.

### Synchronization and seeking

Every scene contains narration and diagram primitives with `reveal` fractions between 0 and 0.9. Voice preparation creates one audio track per scene and measures its **actual duration**. Two client workers limit concurrent speech requests. Audio stays in memory; Blob URLs are revoked on lesson changes/unmount.

The player's absolute time is derived from the current audio track's `currentTime`. The board renders only elements revealed by that scene's progress. Seeking reconstructs the target board directly instead of replaying timers, so rewinding removes future elements. Speed changes use `audio.playbackRate`, keeping audio and visuals on the same clock. User annotations remain scoped to their scenes for the session.

Scene transitions follow the actual audio ending. Individual reveal fractions are authored by the model and scaled to measured narration duration; these are **approximate within-scene timings, not forced-aligned word timestamps**. Word-level alignment is a possible future enhancement.

Browser voice is an explicit free fallback using Web Speech boundary events and estimated durations. Seeking restarts from a nearby word. Some voices do not emit reliable boundary events; their diagrams advance at scene endings. AI voice is the recommended evaluation path for precise continuous seeking. Audio failures are visible; there is no silent switch to fallback narration.

### Validated drawing data

`lib/lesson.ts` defines the shared Zod contract. The renderer supports allowlisted SVG primitives: rectangles, ellipses, text, lines, and arrows, with fixed colors. Generated HTML/JavaScript is never executed. React escapes labels. The server validates data, clamps geometry, and assigns unique element IDs. Model-generated facts and layout can still vary; focused topics and follow-ups help clarify an explanation.

### Storage

No database is required for the assignment. Lessons are stored in browser `localStorage`, capped at 12 and validated on read. Conversation, annotations, and audio are session-only. Reopening a saved lesson requires preparing audio again. There are no accounts or cross-device history. Supabase would be useful for authenticated, cross-device persistence later; leaving it optional keeps the core flow independent of database setup.

## Source layout

```text
app/api/{lesson,chat,speech,status}/route.ts   Node.js endpoints
app/{layout,page}.tsx, globals.css            App entry and responsive styles
components/tutor.tsx                         Chat, library, playback UI, quiz
components/whiteboard.tsx                    SVG renderer and drawing tools
hooks/use-player.ts                          Narration lifecycle and synchronization
lib/lesson.ts                                Schemas and deterministic timeline math
lib/prompts.ts                               Lesson and follow-up prompts
lib/server.ts                                API client, guards, validation, errors
lib/client.ts                                Same-origin requests and exports
lib/sample.ts                                Explicitly labeled sample content
tests/*.test.ts                              Timeline, contracts, request security
tests/e2e/tutor.spec.ts                       Browser journeys with mocked AI/audio
docs/ASSIGNMENT.md                           Original assignment
docs/EVALUATION.md                           Smoke test and submission checklist
```

## Checks

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Browser tests use installed **Google Chrome** locally and Playwright Chromium in CI, and start a local server automatically. If Chrome is unavailable, install it or run `npx playwright install chromium` and set `CI=1` when running browser tests. Restricted Windows environments may require permission to spawn Node workers or launch Chrome. The included GitHub Actions workflow runs formatting, unit tests, production build, typecheck, and browser tests without requiring API secrets.

Unit tests cover timestamp mapping, chapter boundaries, rewind visibility, lesson validation, body limits, cross-origin calls, access codes, and request budgets. Browser tests use an explicit AI fixture and synthetic WAV audio to test actual browser playback without API spending. **Mocked tests do not prove live provider integration.** Complete the real-key smoke test in [docs/EVALUATION.md](docs/EVALUATION.md) before submitting.

## Deploy publicly on Vercel

This is a Node.js Next.js app. A static export cannot run its AI endpoints. Vercel is the intended deployment target; Sites' static/Worker hosting is not the native target for this implementation.

1. Create a **new repository under your own GitHub account**. Upload this project's source, `.env.example`, and `package-lock.json`. Do not push your solution to Braynix's starter repository. Exclude `.env.local`, caches, `node_modules`, and `.next`.
2. In Vercel select **Add New → Project**, import your repository, and keep the **Next.js** preset. Use Node.js 22+, `npm ci`, and `npm run build`. The included `vercel.json` sets the framework and commands. No custom output directory is needed.
3. In **Project Settings → Environment Variables**, set `OPENAI_API_KEY` for Production. Set optional model/access-code variables as desired. Runtime secrets belong on the host, never in the source repository.
4. Deploy. Redeploy after any environment changes. API routes declare a 120-second maximum duration; confirm the host/plan supports that duration. Speech generation uses separate requests with two concurrent calls.
5. Make the production deployment publicly accessible in your hosting protection settings. Open its production URL in incognito and run the entire real-key smoke test.
6. Record the verified production URL in this README, then submit it and your own GitHub URL in the form.

**Deployment status:** The source is prepared for deployment. No public demo has been published from this workspace. Hosting requires your account, API key, and own repository. Replace this paragraph with the verified live URL after publishing.

If you cloned the assignment starter, create your GitHub repository first, then:

```bash
git remote rename origin assignment
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git add .
git commit -m "Build Lumio AI whiteboard tutor"
git push -u origin HEAD
```

Review `git status` and `git diff --cached` before committing to verify that secrets are excluded. GitHub Desktop or the GitHub web interface also works.

## Costs, security, and limitations

- A new lesson makes one structured model request. Voice preparation makes one speech request per scene. A follow-up makes one text request. Replaying prepared audio in the same session makes no new provider calls.
- Set a provider spending budget. A best-effort in-memory limiter allows 12 lessons, 90 speech requests, and 35 follow-ups per IP/10 minutes **per server instance**. Serverless instances do not share counters. For open public traffic use a shared limiter/gateway; an optional access code helps protect a small controlled demo. It is shared demo protection, not account authentication.
- Request inputs are bounded, body size is capped at 64 KiB, and cross-origin browser API calls are rejected. API responses are not cached. Error logs include metadata rather than submitted topic/conversation content.
- Lesson and narration preparation take separate steps. Canceling an in-flight request does not guarantee the provider stops charging for work already started.
- Runtime depends on narration word count, voice, and speed; the prompt targets approximately two minutes. Prepared audio is session-only.
- English and plain Unicode equations are the primary presentation. Complex mathematics does not have a LaTeX renderer. Model content can be inaccurate, and diagrams may need refinement.
- Google Fonts are optional; local sans-serif fallbacks work if external fonts are unavailable.
- OpenAI documents the default Speech API models as retiring on **January 6, 2027**, after this assignment's November deadline. For long-term hosting, migrate the isolated speech route before retirement. A Realtime model requires a different API workflow, not just a model-string change. See the [official speech documentation](https://developers.openai.com/api/docs/guides/text-to-speech).

## Submission

Deadline supplied by Braynix: **18 November 2026**. Submit your accessible GitHub repository, a public working demo, and the [submission form](https://docs.google.com/forms/d/e/1FAIpQLSdFJoTxMEuFZrCHTbEgv7bbg2uLf33SjP7n0w2qUONR4kMRcA/viewform?usp=dialog). Running locally does not complete deployment or form submission.

References: [Next.js App Router](https://nextjs.org/docs/app), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI text to speech](https://developers.openai.com/api/docs/guides/text-to-speech).
