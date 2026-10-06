'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ExternalLink, Music2 } from 'lucide-react';
import { artistCredit, artistKey, ARTIST_PROVIDER_LABELS, type ArtistIdentity } from '@/lib/artists/identity';
import { loadArtistContext, type ArtistContextState } from '@/lib/artists/context';
import ArtistVisual from '@/app/components/ArtistVisual';
import ArtistCredits from '@/app/components/ArtistCredits';
import { Card, CardContent, CardHeader } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import SourceAttribution from '@/app/components/SourceAttribution';

export default function ArtistProfile({ identity }: { identity: ArtistIdentity }) {
  const [state, setState] = useState<ArtistContextState>({ status: 'loading' });
  const heading = useRef<HTMLHeadingElement | null>(null);
  const run = useRef(0);
  const mounted = useRef(false);
  const read = useCallback(() => {
    if (!mounted.current) return;
    const operation = ++run.current;
    setState({ status: 'loading' });
    void Promise.resolve().then(() => {
      if (mounted.current && operation === run.current) setState(loadArtistContext(identity));
    });
  }, [identity]);

  useEffect(() => {
    mounted.current = true;
    // Loading is the SSR state. Read tab metadata only after hydration.
    const operation = ++run.current;
    void Promise.resolve().then(() => {
      if (mounted.current && operation === run.current) setState(loadArtistContext(identity));
    });
    return () => { mounted.current = false; };
  }, [identity]);

  useEffect(() => {
    if (state.status !== 'loading') heading.current?.focus({ preventScroll: true });
  }, [state.status]);

  const context = state.status === 'ready' ? state.context : null;
  const artist = context?.artist ?? artistCredit({ ...identity, name: 'Artist profile' });
  const provider = ARTIST_PROVIDER_LABELS[identity.provider];
  const tracks = context?.tracks ?? [];
  const loading = state.status === 'loading';
  return (
    <main className="artist-profile min-h-screen bg-[var(--bg-base)] text-[var(--text-hi)]">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <Link href={tracks[0]?.origin ?? '/discover'} className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-[var(--text-med)] hover:text-[var(--text-hi)] focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-4">
          <ArrowLeft size={16} aria-hidden="true" />Back to exploring
        </Link>

        <section aria-label="Artist profile" aria-busy={loading} className="space-y-6">
          <Card variant="elev1" className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-8">
              <ArtistVisual key={artistKey(identity)} artist={artist} />
              <div className="w-full min-w-0 flex-1 space-y-4 sm:w-auto">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-med)]">Artist profile · {provider}</p>
                <h1 ref={heading} tabIndex={-1} className="break-words font-display text-4xl leading-tight outline-none sm:text-5xl">{artist.name}</h1>
                {loading ? <p role="status" className="text-sm text-[var(--text-med)]">Loading artist context…</p>
                  : context ? <p className="max-w-xl text-sm leading-relaxed text-[var(--text-med)]">Credits supplied by {provider}. Track context comes from what you explored in this tab.</p>
                  : state.status === 'error' ? <p className="text-sm leading-relaxed text-[var(--text-med)]">This tab’s artist metadata could not be read. Retry below to recover available context.</p>
                  : <p className="text-sm leading-relaxed text-[var(--text-med)]">This tab has no name or track credits for this artist reference. Choose an artist from a track to bring that context here.</p>}
                {!loading && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Artist type: {artist.entityType}</Badge>
                    {context && <Badge variant="outline">{tracks.length} {tracks.length === 1 ? 'track credit' : 'track credits'} in this tab</Badge>}
                  </div>
                )}
                {artist.url && (
                  <a href={artist.url} target="_blank" rel="noopener noreferrer" aria-label={`View artist on ${provider} (opens in a new tab)`}
                    className="inline-flex min-h-14 max-w-full flex-wrap items-center gap-4 rounded-lg border border-[var(--border-subtle)] px-4 py-4 text-sm text-[var(--text-hi)] hover:border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2">
                    {identity.provider === 'spotify' && <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brands/spotify-white.png" alt="" width={90} height={27} className="hidden h-auto w-[90px] dark:block" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brands/spotify-black.png" alt="" width={90} height={27} className="block h-auto w-[90px] dark:hidden" />
                    </>}
                    <span className="inline-flex items-center gap-2"><span>{identity.provider === 'spotify' ? 'Artist page' : `View artist on ${provider}`}</span><ExternalLink size={15} aria-hidden="true" className="shrink-0" /></span>
                  </a>
                )}
              </div>
            </div>
            <dl className="grid gap-5 border-t border-[var(--border-subtle)] pt-6 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase tracking-widest text-[var(--text-med)]">Source identity</dt><dd className="mt-2 break-all font-mono text-xs">{provider} / {identity.id}</dd></div>
              <div><dt className="text-xs uppercase tracking-widest text-[var(--text-med)]">Artist type</dt><dd className="mt-2">{artist.entityType}{artist.typeEvidence ? ' · supplied by MusicBrainz' : context ? ' · source did not supply artist type' : ' · type evidence unavailable'}</dd></div>
            </dl>
          </Card>

          {state.status === 'error' && <Card role="alert" className="space-y-3"><h2 className="font-display text-2xl">Artist context could not load</h2><p className="text-sm text-[var(--text-med)]">This browser could not read the track context for this tab. Try again, or explore a track to rebuild it.</p><Button variant="secondary" className="min-h-11" onClick={read}>Try loading again</Button></Card>}
          {state.status === 'ready' && state.temporary && <p role="status" className="text-sm text-[var(--text-med)]">This context is available for this visit. Your browser could not keep it for a page reload.</p>}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card role="region" aria-label="Explored track credits" className="min-w-0">
              <CardHeader><div><p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-med)]">Your exploration</p><h2 className="font-display text-2xl leading-tight">Tracks in this tab</h2></div><Music2 size={20} aria-hidden="true" className="shrink-0 text-[var(--text-med)]" /></CardHeader>
              <CardContent>
                {loading ? <p className="text-sm text-[var(--text-med)]">Loading known track credits…</p>
                  : state.status === 'error' ? <p className="text-sm leading-relaxed text-[var(--text-med)]">Track credits could not load. Retry artist context above to check what is available.</p>
                  : tracks.length ? <ul className="divide-y divide-[var(--border-subtle)]">{tracks.map((track) => <li key={track.key} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <h3 className="break-words font-display text-2xl leading-tight">{track.title}</h3>
                    <ArtistCredits song={track} origin={track.origin} />
                    {(track.album || track.year) && <p className="break-words text-xs text-[var(--text-med)]">{[track.album, track.year].filter(Boolean).join(' · ')}</p>}
                    <p className="text-xs text-[var(--text-med)]">Track credit · analysis status not connected</p>
                    <SourceAttribution song={track} />
                  </li>)}</ul>
                    : <div className="space-y-3"><p className="text-sm leading-relaxed text-[var(--text-med)]">No track credits are available in this tab. Artist links from selected tracks bring their source metadata here.</p><Button asChild variant="secondary" className="min-h-11"><Link href="/discover">Explore a track<ArrowUpRight size={15} aria-hidden="true" /></Link></Button></div>}
              </CardContent>
            </Card>
            <div className="min-w-0 space-y-6">
              <Card>
                <CardHeader><h2 className="font-display text-2xl leading-tight">More about the artist</h2></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed text-[var(--text-med)]">Biography and verified artist imagery are not available from these track credits. The artist’s source page is the place to learn more about their story and releases.</p>
                  <p className="text-xs leading-relaxed text-[var(--text-med)]">Album artwork remains track artwork. Portraits and band marks need their own verified source and display permission.</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h2 className="font-display text-2xl leading-tight">Related readings unavailable</h2></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm leading-relaxed text-[var(--text-med)]">Existing saved readings do not carry artist identifiers, so we cannot reliably connect them to this profile yet.</p>
                  <Link href="/atlas" className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4">Browse public readings in the Atlas<ArrowUpRight size={15} aria-hidden="true" /></Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
