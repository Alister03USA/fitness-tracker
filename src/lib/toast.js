let listeners = [];
let idCounter = 0;

export function subscribeToast(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/**
 * showToast("Profile updated!") → info
 * showToast("Profile updated!", "success")
 * showToast("Failed to save: " + err.message, "error")
 */
export function showToast(message, type = "info") {
  const toast = { id: ++idCounter, message, type };
  listeners.forEach((fn) => fn(toast));
}
