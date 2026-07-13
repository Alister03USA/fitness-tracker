let handler = null;

export function registerConfirmHandler(fn) {
  handler = fn;
}

/**
 * Drop-in-ish replacement for window.confirm, but async and app-styled.
 * confirmDialog("Delete this post?") → Promise<boolean>
 * confirmDialog({ title: "Delete group", message: "...", danger: true, confirmLabel: "Delete" })
 */
export function confirmDialog(options) {
  const opts = typeof options === "string" ? { message: options } : options;
  if (!handler) {
    // ConfirmHost not mounted yet (shouldn't happen once App.jsx renders it) — fail safe
    return Promise.resolve(window.confirm(opts.message));
  }
  return handler(opts);
}
