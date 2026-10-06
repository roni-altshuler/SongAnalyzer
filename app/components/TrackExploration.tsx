'use client';

import Link from 'next/link';
import { Disc3, ExternalLink } from 'lucide-react';
import type { SongMeta, UseSongAnalysis } from '@/app/hooks/useSongAnalysis';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import SourceAttribution from '@/app/components/SourceAttribution';
import ArtistCredits from '@/app/components/ArtistCredits';

interface TrackExplorationProps {
  song: SongMeta;
  stage: UseSongAnalysis['stage'];
  loading: boolean;
  error: string;
  hasAnalysis: boolean;
  onClear?: () => void;
  /** Keep the selected track when changing modes inside the workbench. */
  onLyrics?: () => void;
  onUpload?: () => void;
}

/** Selected-track context stays visible even when audio insights cannot run. */
export default function TrackExploration({
  song, loading, error, hasAnalysis, onClear, onLyrics, onUpload,
}: TrackExplorationProps) {
  const unavailable = !loading && !hasAnalysis && !error;
  const status = loading
    ? 'Reading local audio'
    : error ? 'Audio insights unavailable'
    : hasAnalysis ? 'Local clip insights ready' : 'Audio insights unavailable';

  return (
    <Card variant="elev1" className="track-exploration space-y-4" role="region" aria-label="Explore selected track">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev2)]">
          {song.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={song.coverUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            <Disc3 aria-hidden="true" size={28} className="text-[var(--text-med)]" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-med)]">
            Explore this track
          </p>
          <h2 className="break-words font-display text-2xl leading-tight text-[var(--text-hi)]">{song.title}</h2>
          <ArtistCredits song={song} />
        </div>
        {onClear && (
          <Button variant="ghost" size="sm" className="min-h-11 shrink-0" onClick={onClear} aria-label="Clear selected track">
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
        <div role="status" aria-live="polite" aria-atomic="true">
          <Badge variant="outline">{status}</Badge>
        </div>
        {loading ? (
          <p className="text-sm leading-relaxed text-[var(--text-med)]">
            Measuring the local clip in your browser.
          </p>
        ) : error ? (
          <p role="alert" className="break-words text-sm leading-relaxed text-[var(--state-error)]">{error}</p>
        ) : hasAnalysis ? (
          <p className="text-sm leading-relaxed text-[var(--text-med)]">
            These insights describe the analyzed clip. Other passages in the recording may sound different.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--text-med)]">
            Remote previews are not available for analysis here. Open the track to listen,
            or choose a local file you have permission to analyze for a separate reading.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(unavailable || error) && (onUpload ? (
          <Button variant="secondary" className="min-h-11" onClick={onUpload}>Analyze a local file</Button>
        ) : (
          <Button asChild variant="secondary" className="min-h-11"><Link href="/analyze?mode=audio">Analyze a local file</Link></Button>
        ))}
        {onLyrics ? (
          <Button variant="ghost" className="min-h-11" onClick={onLyrics}>Analyze lyrics</Button>
        ) : (
          <Button asChild variant="ghost" className="min-h-11"><Link href="/analyze?mode=lyrics">Analyze lyrics</Link></Button>
        )}
        {song.geniusId && (
          <Button asChild variant="ghost" className="min-h-11">
            <a href={`https://genius.com/songs/${encodeURIComponent(String(song.geniusId))}`} target="_blank" rel="noopener noreferrer" aria-label="View on Genius (opens in a new tab)">View on Genius <ExternalLink aria-hidden="true" size={14} /></a>
          </Button>
        )}
      </div>
      <SourceAttribution song={song} />
    </Card>
  );
}
