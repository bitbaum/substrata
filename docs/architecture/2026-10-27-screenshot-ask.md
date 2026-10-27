# Ask with a screenshot: read, check, answer

Decided 2026-10-27, after the owner tried to ask Substrata about a screenshot of
a post (AI "neoclouds" that could collapse, SpaceX's GPU debt, CoreWeave's
fall, Gartner's revenue gap): "there was no way for me to attach the
screenshots … I'm not sure what the quality of answer would be."

## The box

One composer on the home page, in the Ask panel and on /chat:
`components/portal/chat/AskComposer.tsx`, chatkit's `Composer` with
attachments on — Camera · Photos · Files on a phone, paste and drop, the picture
shrunk to 1024px in the browser before it is staged (Heidi's limits, in
`lib/chat/image.ts`). Pictures and text files only: chatkit's composer refuses a
PDF with a sentence. The home box does not answer; it hands the message, with
its attachments, to /chat through the tab's session store
(`lib/chat/handoff.ts`), and /chat sends it at once.

## The answer

A turn that brings material — a picture, an attached text file, or a pasted
post (long, with figures) — is a claim check (`lib/chat-agent/claim-check.ts`):

1. **Read** (`lib/chat-agent/read-claims.ts`): one model call returns the
   visible text and up to six checkable claims as JSON. Code keeps a claim only
   when every number in it was printed in what the model read. A picture goes
   only to a model that can see: ai-kit skips the links declared blind.
2. **Check** (`lib/chat-agent/claim-plan.ts`): one web search per claim, aimed
   at it (attribution, figures, year), read by research mode's reader
   (`lib/chat-agent/research-read.ts`) as "Checking: <claim>…"; a listed company
   in the market seed also gets the market tools.
3. **Answer** (`lib/chat-agent/claim-shape.ts`): bottom line first, then one
   line per claim — Confirmed, Partly, Contradicted or Not found — then the
   reasoning, labelled, and what would change the view. Every guard of the
   ordinary path runs (`lib/chat-agent/check-answer.ts`). Code then makes sure
   a status other than Not found stands only with a citation, every claim gets
   its line, and a figure only the material gives is never repeated as fact.

The material's own words are the reader's, never a source. A picture is never
stored: not in the review log, not in a conversation; a turn keeps the names
of its attachments and the text read off them.

## No model can see

When every reachable link is declared blind, ai-kit raises `NoVisionLinkError`
before any request, and the reader gets one sentence (`BLIND_MESSAGE`): nothing
was looked at, nothing is guessed — paste the text, or add a key that reads
images. On the free chain the links declared able to see are Google's
(when its key is set) and one OpenRouter model; a reader's own key is tried.

## Tests

`test/claim-check.test.ts` runs the whole path on a fixture
(`test/fixtures/screenshot-neocloud.json`) with a fake vision model and a fake
web; the rows are in `test/ask-evals.json`. `scripts/ux/ask-layout.mjs` picks a
picture into /chat's box in a real browser at 320, 390 and 1440px.
