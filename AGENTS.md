<!-- BEGIN:nextjs-agent-rules -->

# The product fits the person

This site loads Loki's feedback widget (`app/layout.tsx`). Whatever a visitor
dislikes, they point at it and choose **Change it for me** or **Show me how to
get there**. Loki then builds that experience, or shows the path and makes it
findable for the next person. Tailoring every product to the person using it is
the direction for the whole fleet. It is defined once, together with what has and
hasn't shipped, in bitbaum/loki `docs/architecture/tailored-experience.md`, so
do not restate it here.

To make a surface changeable in place, put `data-loki-target` and an
`aria-label` on it and call `window.Loki?.report({ target })` from a control
inside it. That control must be a real link to the feedback page, taken over
only when `window.Loki.ready` is true, so it is never a button that does
nothing.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
