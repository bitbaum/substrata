/** What reaches the screen while a model turn is still arriving. */
// ---------------------------------------------------------------------------
// The stream gate: what reaches the screen while a turn is still arriving.
// ---------------------------------------------------------------------------

const PROTOCOL_LINE = /^\s*(?:[-*>]\s*)?(?:\*\*)?(?:TOOL|ARGS)(?:\*\*)?\s*[:=]/i;
/** Every proper prefix of a protocol key, so a line is held only while it could still become one. */
const PROTOCOL_PREFIX =
  /^(?:t(?:o(?:o(?:l(?:\*{0,2}\s*)?)?)?)?|a(?:r(?:g(?:s(?:\*{0,2}\s*)?)?)?)?)$/i;

/** Could this start of a line still turn into `TOOL:` or `ARGS:`? */
export function couldBeProtocol(start: string): boolean {
  const bare = start.replace(/^\s*(?:[-*>]\s*)?(?:\*{1,2})?/, '');
  return bare === '' || PROTOCOL_PREFIX.test(bare);
}

/**
 * Holds back exactly what must not be shown: a `<think>` preamble and any
 * tool-protocol line. Everything else passes through as it arrives. Once a
 * protocol line is seen the rest of the turn is withheld — the turn is a tool
 * call, and whatever prose preceded it is withdrawn by a `reset` event.
 */
export class StreamGate {
  private pending = '';
  private lineOpen = false;
  private thinking = false;
  private started = false;
  suppressed = false;
  emitted = '';

  feed(chunk: string): string {
    if (this.suppressed) return '';
    this.pending += chunk;
    let out = '';
    for (;;) {
      if (this.thinking) {
        const end = this.pending.indexOf('</think>');
        if (end === -1) return this.done(out);
        this.pending = this.pending.slice(end + '</think>'.length).replace(/^\s+/, '');
        this.thinking = false;
        continue;
      }
      if (!this.started) {
        const head = this.pending.trimStart();
        if (!head) return this.done(out);
        if ('<think>'.startsWith(head.slice(0, 7)) && head.length < 7) return this.done(out);
        this.started = true;
        if (head.startsWith('<think>')) {
          this.thinking = true;
          this.pending = head.slice('<think>'.length);
          continue;
        }
      }
      const newline = this.pending.indexOf('\n');
      if (this.lineOpen) {
        // The start of this line already went out; the rest follows freely.
        if (newline === -1) {
          out += this.pending;
          this.pending = '';
          return this.done(out);
        }
        out += this.pending.slice(0, newline + 1);
        this.pending = this.pending.slice(newline + 1);
        this.lineOpen = false;
        continue;
      }
      if (newline === -1) {
        if (couldBeProtocol(this.pending) && this.pending.length < 40) return this.done(out);
        if (PROTOCOL_LINE.test(this.pending)) {
          this.suppressed = true;
          this.pending = '';
          return this.done(out);
        }
        out += this.pending;
        this.pending = '';
        this.lineOpen = true;
        return this.done(out);
      }
      const line = this.pending.slice(0, newline + 1);
      if (PROTOCOL_LINE.test(line)) {
        this.suppressed = true;
        this.pending = '';
        return this.done(out);
      }
      out += line;
      this.pending = this.pending.slice(newline + 1);
    }
  }

  /** Whatever was held back and turned out to be prose. */
  flush(): string {
    if (this.suppressed || this.thinking) return '';
    const rest = PROTOCOL_LINE.test(this.pending) ? '' : this.pending;
    this.pending = '';
    return this.done(rest);
  }

  private done(out: string): string {
    this.emitted += out;
    return out;
  }
}
