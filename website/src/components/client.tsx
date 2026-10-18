"use client";

import { useState, useSyncExternalStore } from "react";

// The `dark` class on <html> is the source of truth (set before paint by layout.tsx).
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeToTheme, isDark, () => null);
  const toggle = () => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("vigie-theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      className={`grid size-11 place-items-center rounded-xl text-ink-soft transition-colors hover:bg-wash hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}

export function CopyButton({ text, label = "Copier la commande", tone = "dark" }: { text: string; label?: string; tone?: "dark" | "light" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      className={`shrink-0 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors ${
        tone === "dark" ? "text-band-muted hover:bg-white/10 hover:text-band-text" : "text-ink-soft hover:bg-wash hover:text-ink"
      }`}
    >
      <span aria-live="polite">{copied ? "Copié" : "Copier"}</span>
    </button>
  );
}
