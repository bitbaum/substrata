/**
 * The Substrata mark: four compressed layers. It is the only pictorial
 * element in the chrome, so it has to read at 22px in the header and at
 * 32px as the favicon without becoming a different drawing.
 */
import React from 'react';

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect x="3" y="4" width="26" height="5" rx="1.5" fill="currentColor" opacity="0.3" />
      <rect x="5" y="11" width="22" height="5" rx="1.5" fill="currentColor" opacity="0.5" />
      <rect x="7" y="18" width="18" height="5" rx="1.5" fill="currentColor" opacity="0.75" />
      <rect x="9" y="25" width="14" height="5" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16.5 20.5 21" strokeLinecap="round" />
    </svg>
  );
}
