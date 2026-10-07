'use client';

import { Card } from './ui/Card';
import { Button } from './ui/Button';

interface EmptyStateProps {
  mode?: 'lyrics' | 'audio';
  onStart?: () => void;
  onSwitchMode?: () => void;
}

export default function EmptyState({ mode = 'lyrics', onStart, onSwitchMode }: EmptyStateProps) {
  const audio = mode === 'audio';
  const details = audio
    ? [['Rhythm & tone', 'Read clip-wide tempo, key and energy estimates.'],
      ['A closer listen', 'Select passages, compare signal levels and play one window.']]
    : [['Mood & meaning', 'Explore the emotions and themes in the words.'],
      ['A second perspective', 'Add audio to compare the words with the sound.']];

  return (
    <Card variant="elev1" className="relative overflow-hidden p-6 sm:p-8">
      <div className="mb-7 flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-med)]">
          Listening studio
        </p>
        <span className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs text-[var(--text-med)]">
          {audio ? 'Sound' : 'Words'}
        </span>
      </div>

      {/* An original record illustration, never a simulated measurement. */}
      <svg viewBox="0 0 220 100" className="mb-5 h-24 w-auto text-[var(--accent-from)]" fill="none" aria-hidden="true">
        <circle cx="65" cy="50" r="46" stroke="currentColor" strokeOpacity="0.18" />
        <circle cx="65" cy="50" r="35" stroke="currentColor" strokeOpacity="0.3" />
        <circle cx="65" cy="50" r="23" stroke="currentColor" strokeOpacity="0.5" />
        <circle cx="65" cy="50" r="6" fill="currentColor" />
        <path d="M65 4a46 46 0 0 1 46 46M65 27a23 23 0 0 1 23 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M128 50h15m9-12v24m10-38v52m10-30v8m10-24v40m10-32v24m10-12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.65" />
      </svg>

      <h2 className="font-display text-3xl leading-tight tracking-tight text-[var(--text-hi)] sm:text-4xl">
        {audio ? 'Hear the feeling.' : 'Read between the lines.'}
      </h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--text-med)]">
        {audio
          ? 'Choose a local recording you own or have permission to analyze. Listening windows and a clip-wide reading will appear here.'
          : 'Bring a verse, a chorus, or a whole song. Your lyrics analysis will appear here.'}
      </p>

      <dl className="my-6 space-y-4 border-y border-[var(--border-subtle)] py-5">
        {details.map(([title, description]) => (
          <div key={title}>
            <dt className="text-sm font-medium text-[var(--text-hi)]">{title}</dt>
            <dd className="mt-1 text-xs leading-5 text-[var(--text-med)]">{description}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {onStart && (
          <Button variant="secondary" onClick={onStart} className="min-h-11">
            {audio ? 'Choose an audio file' : 'Start with lyrics'}
            <span aria-hidden="true">↗</span>
          </Button>
        )}
        {onSwitchMode && (
          <Button variant="ghost" onClick={onSwitchMode} className="min-h-11">
            {audio ? 'Explore lyrics' : 'Try audio instead'}
          </Button>
        )}
      </div>
    </Card>
  );
}
