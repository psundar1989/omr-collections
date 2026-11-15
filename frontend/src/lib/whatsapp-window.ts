/**
 * One shared browser tab for WhatsApp orders.
 *
 * Every order flow used `window.open("", "_blank")`, and `_blank` always creates a new tab,
 * so each order left another WhatsApp tab behind. All order flows now target the same named
 * window, so the browser reuses that tab whenever it can still reach it.
 *
 * Note: WhatsApp's pages send a Cross-Origin-Opener-Policy header. Once that page loads,
 * some browsers cut the tab off from this site and clear its name. In that case the next
 * order opens a fresh tab, which is the same as before; nothing breaks.
 */

export const WHATSAPP_WINDOW = "WhatsAppOrder";

let handle: Window | null = null;

/** True while `win` is still our own blank placeholder (same-origin about:blank). */
function isPlaceholder(win: Window): boolean {
  try {
    return win.location.href === "about:blank";
  } catch {
    return false; // cross-origin: it is already showing WhatsApp
  }
}

export type WhatsAppTab = {
  /** Point the tab at the WhatsApp URL (falls back to this tab if the popup was blocked). */
  go: (url: string) => void;
  /** The order failed: close the tab, but only if it is the blank placeholder we just opened. */
  cancel: () => void;
};

/**
 * Call synchronously inside the click handler, before any `await`, so popup blockers treat
 * it as user-initiated. Reuses the named WhatsApp tab if it still exists.
 */
export function openWhatsAppTab(): WhatsAppTab {
  let win: Window | null = handle && !handle.closed ? handle : null;
  let created = false;
  if (!win) {
    // An empty URL never navigates an existing window with this name. It only finds or creates it.
    // No "noopener": that would return null and break both the reuse and the redirect below.
    win = window.open("", WHATSAPP_WINDOW);
    created = !!win && isPlaceholder(win);
  }
  handle = win;

  return {
    go(url) {
      if (win && !win.closed) {
        win.location.href = url; // setting location is allowed even cross-origin
        win.focus();
      } else {
        window.location.href = url; // popup blocked (common on mobile): use this tab
      }
    },
    cancel() {
      if (win && created && !win.closed && isPlaceholder(win)) win.close();
    },
  };
}

/**
 * Click handler for plain WhatsApp order links (`<a href={url} target={WHATSAPP_WINDOW}>`).
 * It sends the link through the same shared tab.
 */
export function openWhatsAppLink(e: { preventDefault: () => void }, url: string): void {
  e.preventDefault();
  openWhatsAppTab().go(url);
}
