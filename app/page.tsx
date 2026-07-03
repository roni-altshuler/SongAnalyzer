import Link from 'next/link';

import { moodToColor } from '@/lib/analysis/palette';
import { getAtlasOverview } from '@/lib/atlas/queries';
import { Button } from './components/ui/Button';
import { Card } from './components/ui/Card';
import { Spectrum } from './components/ui/Spectrum';

/**
 * Landing page — the product's front door.
 *
 * Server component: the workbench lives at /analyze now (see that page),
 * identification at /identify, similarity exploration at /discover. Each
 * feature panel scopes its own mood palette by setting the accent CSS vars
 * inline — the same cascade mechanism the analysis flows use globally.
 */

/** Fail-soft Atlas stats (CLAUDE.md pattern) — null hides the stats band. */
async function tryGetOverview() {
  try {
    return await getAtlasOverview();
  } catch {
    return null;
  }
}

function accentStyle(mood: string): React.CSSProperties {
  const { from, to, glow } = moodToColor(mood);
  return {
    '--accent-from': from,
    '--accent-to': to,
    '--accent-glow': glow,
  } as React.CSSProperties;
}

const PANELS = [
  {
    mood: 'Euphoric',
    eyebrow: 'Identify',
    title: 'Name that beat.',
    body: 'Hold your device to the music. A spectral-peak constellation — the same math behind the classic recognizers — is fingerprinted in your browser and matched in milliseconds. No audio ever leaves your device.',
    href: '/identify',
    cta: 'Start listening',
  },
  {
    mood: 'Romantic',
    eyebrow: 'Analyze',
    title: 'Two engines, one feeling.',
    body: 'Lyrics flow through a transformer-plus-keyword hybrid; audio through a real MIR pipeline — beat grid, key detection, timbre, valence and arousal. Where words and sound disagree, the combined view shows the tension.',
    href: '/analyze',
    cta: 'Analyze a song',
  },
  {
    mood: 'Peaceful',
    eyebrow: 'Discover',
    title: 'Follow the feeling.',
    body: 'Every analysis becomes a 48-dimension sonic fingerprint in a shared mood space. Start anywhere and walk to what feels the same — by sound, not genre tags — then zoom out on the public Mood Atlas.',
    href: '/discover',
    cta: 'Explore the space',
  },
] as const;

export default async function LandingPage() {
  const overview = await tryGetOverview();

  return (
    <main className="relative overflow-hidden bg-[var(--bg-base)] text-[var(--text-hi)]">
      {/* Ambient mood backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in_oklab, var(--accent-glow) 70%, transparent), transparent 60%), radial-gradient(ellipse 40% 30% at 85% 70%, color-mix(in_oklab, var(--accent-to) 16%, transparent), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Hero ── */}
      <section className="container mx-auto max-w-6xl px-4 pb-20 pt-20 text-center md:pt-28">
        <div className="mb-6 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.32em] text-[var(--text-low)]">
          <span aria-hidden className="inline-block h-px w-8 bg-[var(--border-strong)]" />
          Identify · Analyze · Discover
          <span aria-hidden className="inline-block h-px w-8 bg-[var(--border-strong)]" />
        </div>

        <h1 className="font-display text-6xl leading-[0.95] tracking-tight md:text-8xl">
          <span className="text-[var(--text-hi)]">Every song has a</span>
          <br />
          <span className="text-accent-gradient italic">fingerprint.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--text-med)] md:text-lg">
          Identify a track from ten seconds of its beat. Decode its mood from lyrics and audio
          with dual engines. Discover what feels the same — while the song&rsquo;s color washes
          over the page.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/identify">Identify a song</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/analyze">Analyze lyrics or audio</Link>
          </Button>
        </div>

        <div className="mx-auto mt-12 h-14 w-full max-w-lg opacity-70">
          <Spectrum bars={48} className="h-full w-full" />
        </div>
      </section>

      {/* ── Feature panels — each scoped to its own mood palette ── */}
      <section className="container mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {PANELS.map((panel) => (
            <div key={panel.href} style={accentStyle(panel.mood)}>
              <Card variant="elev1" interactive className="flex h-full flex-col gap-4 p-7">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-low)]">
                    {panel.eyebrow}
                  </p>
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-from), var(--accent-to))',
                      boxShadow: '0 0 12px var(--accent-glow)',
                    }}
                  />
                </div>
                <h2 className="font-display text-3xl leading-tight">
                  <span className="text-accent-gradient">{panel.title}</span>
                </h2>
                <p className="flex-1 text-sm leading-relaxed text-[var(--text-med)]">{panel.body}</p>
                <Link
                  href={panel.href}
                  className="group inline-flex items-center gap-1.5 text-sm text-[var(--text-hi)] underline-offset-4 hover:underline"
                >
                  {panel.cta}
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                    →
                  </span>
                </Link>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* ── How identification works ── */}
      <section className="border-y border-[var(--border-subtle)] bg-[var(--bg-elev1)]/40">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Listen',
                body: 'Ten seconds of audio, captured locally. The signal is reduced to its loudest spectral peaks — a constellation unique to the recording, robust to noise.',
              },
              {
                step: '02',
                title: 'Hash',
                body: 'Peak pairs pack into 24-bit hashes inside a Web Worker. Only these integers travel to the server — the audio itself never does.',
              },
              {
                step: '03',
                title: 'Align',
                body: 'Thousands of catalog hashes vote on time alignment. A true match is a sharp spike; everything else is noise. Then the mood engines take over.',
              },
            ].map((item) => (
              <div key={item.step} className="space-y-3">
                <p className="font-mono text-xs tracking-[0.3em] text-[var(--text-low)]">{item.step}</p>
                <h3 className="font-display text-2xl text-[var(--text-hi)]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--text-med)]">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Atlas stats teaser (fail-soft) ── */}
      {overview && overview.totalAnalyses > 0 && (
        <section className="container mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex gap-10 text-center md:gap-14 md:text-left">
              <div>
                <p className="font-display text-4xl text-[var(--text-hi)]">
                  {overview.totalAnalyses.toLocaleString()}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-low)]">
                  analyses
                </p>
              </div>
              <div>
                <p className="font-display text-4xl text-[var(--text-hi)]">
                  {overview.totalArtists.toLocaleString()}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-low)]">
                  artists
                </p>
              </div>
              <div>
                <p className="font-display text-4xl text-[var(--text-hi)]">
                  {overview.moodDistribution.length}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-low)]">
                  moods mapped
                </p>
              </div>
            </div>
            <Button asChild variant="secondary">
              <Link href="/atlas">Open the Mood Atlas</Link>
            </Button>
          </div>
        </section>
      )}

      {/* ── Final CTA ── */}
      <section className="container mx-auto max-w-6xl px-4 pb-24 pt-8 text-center">
        <h2 className="font-display text-4xl tracking-tight md:text-5xl">
          <span className="text-[var(--text-med)]">Something playing?</span>{' '}
          <span className="text-accent-gradient italic">Catch it.</span>
        </h2>
        <div className="mt-6">
          <Button asChild size="lg">
            <Link href="/identify">Identify what&rsquo;s playing</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
