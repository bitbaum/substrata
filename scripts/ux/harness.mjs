/**
 * The step counter every task flow runs through.
 *
 * A step is one thing a person has to do: a click, a keystroke into a field,
 * a choice in a select, a tick — and every SCREEN of scrolling needed to
 * reach the thing they act on or read. Scrolls count because a primary action
 * three screens down costs a phone reader three moves before the first one,
 * and a count of clicks alone would call that page "one step".
 *
 * Arriving on the tool's own URL is not a step: the task starts there.
 */

/** How much of a screen a person scrolls per flick, as a share of the viewport. */
const FLICK = 0.8;

export class DeadEnd extends Error {}

export function makeContext(page, { viewport }) {
  let started = Date.now();
  const log = [];
  let steps = 0;
  let answeredAt = null;

  /** Screens of scrolling to bring `locator` fully into view from where the page is now. */
  async function scrollsTo(locator) {
    await locator.first().waitFor({ state: 'attached', timeout: 15_000 });
    const box = await locator.first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      // Fixed bars (the phone tab bar, the top bar) cover part of the viewport.
      const bottomBar = document.querySelector('.shell-tabbar');
      const cover = bottomBar ? bottomBar.getBoundingClientRect().height : 0;
      return { top: r.top, bottom: r.bottom, cover, vh: window.innerHeight };
    });
    const visibleBottom = box.vh - box.cover;
    if (box.top >= 0 && Math.min(box.bottom, box.top + 120) <= visibleBottom) return 0;
    const distance = Math.min(box.bottom, box.top + 120) - visibleBottom;
    return Math.max(1, Math.ceil(distance / (box.vh * FLICK)));
  }

  async function reach(locator, why) {
    const n = await scrollsTo(locator);
    if (n > 0) {
      steps += n;
      log.push(`scroll ×${n} to ${why}`);
    }
    await locator.first().scrollIntoViewIfNeeded();
  }

  const ctx = {
    page,
    viewport,
    get steps() {
      return steps;
    },
    log,
    async go(path) {
      started = Date.now();
      // The clock starts here. It stops when the answer is visible, not at the
      // load event: a slow analytics script is not a slow answer.
      await page.goto(ctx.base + path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    },
    async click(locator, why) {
      await reach(locator, why);
      steps += 1;
      log.push(`click ${why}`);
      await locator.first().click();
    },
    async fill(locator, text, why) {
      await reach(locator, why);
      steps += 1;
      log.push(`type ${why}`);
      await locator.first().fill(text);
    },
    async press(locator, key, why) {
      steps += 1;
      log.push(`press ${key} ${why}`);
      await locator.first().press(key);
    },
    async select(locator, option, why) {
      await reach(locator, why);
      steps += 1;
      log.push(`choose ${why}`);
      await locator.first().selectOption(option);
    },
    async check(locator, why) {
      await reach(locator, why);
      steps += 1;
      log.push(`tick ${why}`);
      await locator.first().check();
    },
    /** The answer is on screen: scroll to it (counted) and stop the clock. */
    async answer(locator, why, timeout = 20_000) {
      await locator.first().waitFor({ state: 'visible', timeout });
      await reach(locator, why);
      answeredAt ??= Date.now();
      return (await locator.first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 160);
    },
    /** Visible within `timeout`, else null — for branches a page may or may not offer. */
    async optional(locator, timeout = 1_500) {
      try {
        await locator.first().waitFor({ state: 'visible', timeout });
        return locator.first();
      } catch {
        return null;
      }
    },
    elapsed: () => (answeredAt ?? Date.now()) - started,
    answered: () => answeredAt !== null,
  };
  return ctx;
}

/**
 * Whether an empty or error state offers the next action: the block that
 * holds the message must contain a visible link or button of its own.
 */
export async function nextActionNear(page, textPattern) {
  const message = page.getByText(textPattern).first();
  try {
    await message.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    return { found: false, message: null, actions: [] };
  }
  // Only the message's own block counts: its element, or the smallest
  // ancestor that is still just the message (not the whole page).
  const result = await message.evaluate((el) => {
    let block = el;
    for (let i = 0; i < 3 && block; i += 1) {
      if (block.innerText.length > 600) break;
      const actions = [...block.querySelectorAll('a[href], button')].filter(
        (a) => a.getBoundingClientRect().width > 0,
      );
      if (actions.length > 0) return actions.map((a) => a.textContent.trim()).slice(0, 4);
      block = block.parentElement;
    }
    return [];
  });
  const text = (await message.innerText()).replace(/\s+/g, ' ').trim().slice(0, 140);
  return { found: true, message: text, actions: result };
}
