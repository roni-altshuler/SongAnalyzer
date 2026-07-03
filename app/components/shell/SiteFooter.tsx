import Link from 'next/link';

/**
 * Global footer — attribution + data-quality notes that used to live at the
 * bottom of the single-page app. Server component; no interactivity.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-1">
            <p className="font-display text-base text-[var(--text-hi)]">SongAnalyzer</p>
            <p className="text-xs tracking-wide text-[var(--text-low)]">
              Beat · Lyric · Mood — identified, decoded, and mapped.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[var(--text-med)]">
            <Link href="/identify" className="hover:text-[var(--text-hi)] transition-colors">Identify</Link>
            <Link href="/analyze" className="hover:text-[var(--text-hi)] transition-colors">Analyze</Link>
            <Link href="/discover" className="hover:text-[var(--text-hi)] transition-colors">Discover</Link>
            <Link href="/atlas" className="hover:text-[var(--text-hi)] transition-colors">Atlas</Link>
          </nav>
        </div>

        <div className="mt-8 space-y-1.5 border-t border-[var(--border-subtle)] pt-6 text-center text-[11px] leading-relaxed text-[var(--text-low)]">
          <p className="tracking-wide">
            Analysis runs in your browser — audio never leaves your device; only
            non-reversible fingerprint hashes and feature vectors are stored.
          </p>
          <p className="tracking-wide opacity-80">
            Song metadata via Spotify, MusicBrainz &amp; Genius (metadata only — never lyrics).
            More lyrics or longer audio → sharper analysis.
          </p>
        </div>
      </div>
    </footer>
  );
}
