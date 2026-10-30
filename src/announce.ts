// Screen reader announcements through one polite live region per document, rate-limited. The same
// contract as Fizlet's `fizlet/announce` brick (proposed): a later `npm run sync` swaps this import
// for the engine's. Call `say` change-only from render code (a HUD write), never from a step.
export interface Announcer {
  /** Queue `text` under `key`; a newer text for the same key replaces the pending one. */
  say(key: string, text: string): void;
  /** Write what is pending now. */
  flush(): void;
  /** Clear the timer; remove the region if this announcer created it. */
  destroy(): void;
}

// Visually hidden, still in the accessibility tree (the brick's style: no scroll, no hit target).
const HIDE = "position:fixed;clip-path:inset(50%);white-space:nowrap";

export function announcer({ gap = 1, doc = document }: { gap?: number; doc?: Document } = {}): Announcer {
  const pending = new Map<string, string>();
  let el: HTMLElement | null = null, mine = false, dead = false, last = -Infinity, timer: ReturnType<typeof setTimeout> | undefined;
  const region = () => {
    if (el?.isConnected) return el;
    el = doc.querySelector<HTMLElement>("[data-fz-announce]");
    if (!el) {
      el = doc.createElement("div");
      el.setAttribute("data-fz-announce", "");
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      el.style.cssText = HIDE;
      doc.body.append(el);
      mine = true;
    }
    return el;
  };
  function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (!pending.size) return;
    let text = [...pending.values()].join(". ");
    pending.clear();
    const r = region();
    if (r.textContent === text) text += " "; // the same words again still speak
    r.textContent = text;
    last = Date.now();
  }
  return {
    say(key, text) {
      if (dead) return;
      pending.set(key, text);
      timer ??= setTimeout(flush, Math.max(0, last + gap * 1000 - Date.now()));
    },
    flush,
    destroy() {
      dead = true;
      clearTimeout(timer);
      timer = undefined;
      pending.clear();
      if (mine) el?.remove();
      el = null;
    },
  };
}
