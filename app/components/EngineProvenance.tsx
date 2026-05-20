'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@/lib/types';
import { Badge } from '@/app/components/ui/Badge';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from '@/app/components/ui/Modal';
import { cn } from '@/lib/cn';

interface EngineProvenanceProps {
  engines: NonNullable<AnalysisResult['engines']>;
  className?: string;
}

/**
 * Inline provenance row showing which engines produced the result.
 *
 * Surfaces the v2 hybrid pipeline transparently — "transformer ✓ joy 0.82,
 * keyword ✓ +5/−2". Clicking the row opens a modal with the full per-engine
 * breakdown (all transformer scores, keyword bucket counts).
 */
export default function EngineProvenance({ engines, className }: EngineProvenanceProps) {
  const [open, setOpen] = useState(false);

  const t = engines.transformer;
  const k = engines.keyword;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'group flex flex-wrap items-center gap-2 text-xs',
          'rounded-md -mx-1 px-1 py-0.5',
          'hover:bg-[var(--bg-elev2)] transition-colors',
          'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
          className,
        )}
        aria-label="Show engine details"
      >
        {t.status === 'ok' ? (
          <Badge variant="mood" title={t.model ?? 'transformer'}>
            <span className="opacity-80">transformer</span>
            {t.scores?.[0] && (
              <span className="ml-1.5 font-mono opacity-95">
                {t.scores[0].label} · {t.scores[0].score.toFixed(2)}
              </span>
            )}
          </Badge>
        ) : (
          <Badge variant="outline" title={t.reason ?? t.status}>
            <span className="opacity-70">transformer · {t.status}</span>
          </Badge>
        )}
        <Badge variant="outline">
          <span className="opacity-80">
            keyword
            {k.scores && (
              <span className="ml-1.5 font-mono opacity-80">
                +{k.scores.positive} / −{k.scores.negative}
              </span>
            )}
          </span>
        </Badge>
        <span className="text-[var(--text-low)] opacity-0 group-hover:opacity-100 transition-opacity">
          details →
        </span>
      </button>

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Engine details</ModalTitle>
            <ModalDescription>
              Per-engine outputs that produced this analysis. Hybrid pipeline =
              transformer (semantic) + keyword (deterministic fallback).
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-5 text-sm">
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-low)] mb-2">
                Transformer
              </h4>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-med)]">Status</span>
                  <Badge variant={t.status === 'ok' ? 'success' : 'outline'}>
                    {t.status}
                  </Badge>
                </div>
                {t.model && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-med)]">Model</span>
                    <span className="font-mono text-xs text-[var(--text-hi)]">
                      {t.model}
                    </span>
                  </div>
                )}
                {t.reason && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--text-med)]">Reason</span>
                    <span className="font-mono text-xs text-[var(--state-warn)]">
                      {t.reason}
                    </span>
                  </div>
                )}
                {t.scores && t.scores.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-[var(--text-low)] mb-2">All emotion scores</p>
                    <ul className="space-y-1.5">
                      {t.scores.map((s) => (
                        <li
                          key={s.label}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-[var(--text-hi)] capitalize">
                            {s.label}
                          </span>
                          <span className="font-mono text-[var(--text-med)] tabular-nums">
                            {s.score.toFixed(3)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-low)] mb-2">
                Keyword
              </h4>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-med)]">Status</span>
                  <Badge variant={k.status === 'ok' ? 'success' : 'outline'}>
                    {k.status}
                  </Badge>
                </div>
                {k.scores && (
                  <div className="pt-2 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-hi)]">Positive</span>
                      <span className="font-mono text-[var(--state-success)] tabular-nums">
                        {k.scores.positive}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-hi)]">Negative</span>
                      <span className="font-mono text-[var(--state-error)] tabular-nums">
                        {k.scores.negative}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-hi)]">Neutral</span>
                      <span className="font-mono text-[var(--text-med)] tabular-nums">
                        {k.scores.neutral}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
