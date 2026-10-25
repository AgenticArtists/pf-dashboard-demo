// Tiny client-side event helpers shared by the app shell and pages.

// toast("Saved", "ok" | "err") — shown by the shell's Toaster.
export function toast(text, kind = "ok") {
  if (typeof window === "undefined" || !text) return;
  window.dispatchEvent(new CustomEvent("pf:toast", { detail: { text, kind } }));
}

// Tells the navigation progress bar a programmatic navigation started.
export function navStart() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pf:navstart"));
}

// Light / dark / system theme, persisted per browser (see the boot script in app/layout.js).
export function applyTheme(next) {
  try {
    if (next === "system") localStorage.removeItem("pf-theme"); else localStorage.setItem("pf-theme", next);
  } catch { /* storage blocked: the choice lasts this page only */ }
  if (next === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", next);
  window.dispatchEvent(new CustomEvent("pf:theme", { detail: next }));
}
