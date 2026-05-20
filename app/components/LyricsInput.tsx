'use client';

import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';

interface LyricsInputProps {
  lyrics: string;
  onLyricsChange: (value: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string;
}

export default function LyricsInput({
  lyrics,
  onLyricsChange,
  onAnalyze,
  loading,
  error,
}: LyricsInputProps) {
  const wordCount = lyrics.trim().split(/\s+/).filter(Boolean).length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Paste lyrics here…\n\nMultiple languages supported — non-English will be auto-translated.\nMore lyrics = sharper analysis.`}
          className="w-full h-80 px-4 py-3 rounded-xl resize-none font-mono text-sm leading-relaxed
            text-[var(--text-hi)] placeholder:text-[var(--text-low)]
            bg-[var(--bg-base)] border border-[var(--border-subtle)]
            focus:outline-none focus:border-[color-mix(in_oklab,var(--accent-from)_60%,var(--border-strong))]
            focus:ring-2 focus:ring-[var(--accent-glow)]
            transition-colors"
        />
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-low)]">
          <span>
            <span className="font-mono">{wordCount}</span> words · ⌘/Ctrl+Enter to analyze
          </span>
          {lyrics.trim() && (
            <button
              type="button"
              onClick={() => onLyricsChange('')}
              className="text-[var(--text-low)] hover:text-[var(--state-error)] transition-colors"
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
        <Card variant="flat" className="border-[var(--state-error)] bg-[color-mix(in_oklab,var(--state-error)_10%,transparent)] p-4 animate-fade-in">
          <p className="text-sm text-[var(--state-error)]">{error}</p>
        </Card>
      )}
    </div>
  );
}
