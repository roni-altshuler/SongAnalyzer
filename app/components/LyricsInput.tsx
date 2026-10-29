'use client';

import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';

interface LyricsInputProps {
  englishConfirmed: boolean;
  onEnglishConfirmedChange: (confirmed: boolean) => void;
  lyrics: string;
  onLyricsChange: (value: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string;
}

export default function LyricsInput({
  lyrics,
  englishConfirmed,
  onEnglishConfirmedChange,
  onLyricsChange,
  onAnalyze,
  loading,
  error,
}: LyricsInputProps) {
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading && lyrics.trim()) {
      e.preventDefault();
      onAnalyze();
    }
  };

  return (
    <div className="space-y-4">
      <Card variant="elev1">
        <label
          htmlFor="lyrics"
          className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-low)] mb-3"
        >
          Paste song lyrics
        </label>
        <textarea
          id="lyrics"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'lyrics-help lyrics-error' : 'lyrics-help'}
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste lyrics here…\n\nUse text you have permission to analyze.\nTranslation depends on service availability.`}
          className="w-full h-80 px-4 py-3 rounded-xl resize-none font-mono text-sm leading-relaxed
            text-[var(--text-hi)] placeholder:text-[var(--text-low)]
            bg-[var(--bg-base)] border border-[var(--border-subtle)]
            focus:outline-none focus:border-[color-mix(in_oklab,var(--accent-from)_60%,var(--border-strong))]
            focus:ring-2 focus:ring-[var(--accent-glow)]
            transition-colors"
        />
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-[var(--text-med)]">
          <p id="lyrics-language-help">English-focused analysis. Automatic language checks are unverified; other languages may produce misleading readings.</p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={englishConfirmed} onChange={event => onEnglishConfirmedChange(event.target.checked)} aria-describedby="lyrics-language-help" className="h-4 w-4 accent-[var(--accent-from)]" />
            I’m providing English text
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 text-xs text-[var(--text-med)]">
          <span id="lyrics-help">
            <span className="font-mono">{wordCount}</span> words · ⌘/Ctrl+Enter to analyze
          </span>
          {lyrics.trim() && (
            <button
              type="button"
              onClick={() => onLyricsChange('')}
              className="min-h-11 px-2 text-[var(--text-med)] hover:text-[var(--state-error)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent-from)]"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      <Button
        variant="primary"
        size="lg"
        onClick={onAnalyze}
        loading={loading}
        disabled={!lyrics.trim()}
        className="w-full"
      >
        {loading ? 'Analyzing…' : 'Analyze lyrics'}
      </Button>

      {error && (
        <Card variant="flat" role="alert" className="border-[var(--state-error)] bg-[color-mix(in_oklab,var(--state-error)_10%,transparent)] p-4 animate-fade-in">
          <p className="mb-1 text-sm font-medium text-[var(--text-hi)]">Couldn&apos;t analyze these lyrics</p>
          <p id="lyrics-error" className="text-sm leading-6 text-[var(--text-med)]">{error}</p>
        </Card>
      )}
    </div>
  );
}
