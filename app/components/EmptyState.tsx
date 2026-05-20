'use client';

import { Card } from './ui/Card';

export default function EmptyState() {
  return (
    <Card variant="elev1" className="text-center py-14">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elev3)]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-med)]"
          aria-hidden="true"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <h3 className="font-display text-xl text-[var(--text-hi)] mb-2">
        Ready when you are
      </h3>
      <p className="text-sm text-[var(--text-med)] mx-auto max-w-sm">
        Paste lyrics on the left and the analysis lands here — mood, vibe, energy, and the
        song&rsquo;s accent color cascading through the page.
      </p>
    </Card>
  );
}
