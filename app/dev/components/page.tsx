'use client';

import { useState } from 'react';
import {
  Album,
  Heart,
  Music,
  Play,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Meter,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
  Skeleton,
  Spectrum,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipProvider,
  toast,
} from '@/app/components/ui';
import { useMoodTheme } from '@/app/providers/mood-theme-provider';

export const dynamic = 'force-static';

const MOOD_SWATCHES = [
  { name: 'Joy', from: '#F59E0B', to: '#EF4444' },
  { name: 'Calm', from: '#22D3EE', to: '#6366F1' },
  { name: 'Sadness', from: '#0EA5E9', to: '#1E293B' },
  { name: 'Anger', from: '#EF4444', to: '#7F1D1D' },
  { name: 'Love', from: '#F472B6', to: '#A855F7' },
  { name: 'Default', from: '#3B82F6', to: '#8B5CF6' },
] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h2 className="font-display text-3xl text-[var(--text-hi)]">{title}</h2>
        {description && (
          <p className="text-sm text-[var(--text-med)] mt-1 max-w-prose">{description}</p>
        )}
      </header>
      <div className="rounded-2xl bg-[var(--bg-elev1)] border border-[var(--border-subtle)] ring-inset-soft p-6">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3 first:pt-0 border-b border-[var(--border-subtle)] last:border-b-0 last:pb-0">
      <span className="w-24 shrink-0 text-xs font-mono uppercase tracking-wider text-[var(--text-low)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function DevComponentsShowcase() {
  const { color, setMoodColor, resetMoodColor } = useMoodTheme();
  const [progress, setProgress] = useState(0.62);

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-hi)] py-16">
        <div className="container mx-auto px-6 max-w-5xl space-y-16">
          {/* ───── Header ───── */}
          <header className="space-y-4">
            <Badge variant="mood">Design System v2</Badge>
            <h1 className="font-display text-6xl leading-[0.95] text-balance">
              UI primitives,
              <br />
              <span className="text-accent-gradient">music-streaming dark</span>.
            </h1>
            <p className="text-[var(--text-med)] max-w-prose">
              Visual reference for every primitive in every variant. Switch the mood
              accent below to see how the tokens propagate through the system.
            </p>
            <div className="relative h-20 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)]">
              <Spectrum bars={64} animated />
            </div>
          </header>

          {/* ───── Mood swatches ───── */}
          <Section
            title="Mood accent swatches"
            description="The MoodThemeProvider rewrites --accent-from, --accent-to, --accent-glow on <html>. Click a swatch to see every primitive on this page repaint."
          >
            <div className="flex flex-wrap gap-3">
              {MOOD_SWATCHES.map((s) => {
                const active = s.from === color.from && s.to === color.to;
                return (
                  <button
                    key={s.name}
                    onClick={() => setMoodColor({ from: s.from, to: s.to })}
                    className="group relative h-20 w-32 rounded-xl overflow-hidden border border-[var(--border-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2"
                    style={{
                      background: `linear-gradient(135deg, ${s.from} 0%, ${s.to} 100%)`,
                    }}
                  >
                    <span className="absolute bottom-2 left-2 right-2 text-left text-xs font-medium text-white drop-shadow">
                      {s.name}
                    </span>
                    {active && (
                      <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                        <Sparkles size={12} />
                      </span>
                    )}
                  </button>
                );
              })}
              <Button variant="ghost" onClick={resetMoodColor}>
                Reset
              </Button>
            </div>
          </Section>

          {/* ───── Typography ───── */}
          <Section
            title="Typography"
            description="Instrument Serif (display) · Inter (body) · JetBrains Mono (numeric)."
          >
            <div className="space-y-3">
              <p className="font-display text-6xl text-balance">Bad Guy — Billie Eilish</p>
              <p className="font-display text-4xl text-balance text-[var(--text-med)]">
                Dancing in the dark
              </p>
              <p className="text-2xl">The quick brown fox jumps over the lazy dog.</p>
              <p className="text-base text-[var(--text-med)]">
                Body copy uses Inter. Optical sizing and ss01/cv11 features are enabled.
              </p>
              <p className="font-mono text-sm text-[var(--text-low)]">
                BPM 128 · KEY F# minor · CONF 0.84
              </p>
            </div>
          </Section>

          {/* ───── Buttons ───── */}
          <Section title="Button">
            <div className="space-y-1">
              <Row label="primary">
                <Button size="sm">Analyze</Button>
                <Button size="md">Analyze</Button>
                <Button size="lg" leftIcon={<Play size={16} />}>
                  Play preview
                </Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
              </Row>
              <Row label="secondary">
                <Button variant="secondary" size="sm">
                  Cancel
                </Button>
                <Button variant="secondary">Cancel</Button>
                <Button variant="secondary" size="lg" leftIcon={<Share2 size={16} />}>
                  Share
                </Button>
              </Row>
              <Row label="ghost">
                <Button variant="ghost" size="sm">
                  Skip
                </Button>
                <Button variant="ghost">More options</Button>
                <Button variant="ghost" size="lg">
                  Learn more
                </Button>
              </Row>
              <Row label="icon">
                <Button variant="icon" size="sm" aria-label="Like">
                  <Heart size={14} />
                </Button>
                <Button variant="icon" aria-label="Play">
                  <Play size={16} />
                </Button>
                <Button variant="icon" size="lg" aria-label="Close">
                  <X size={18} />
                </Button>
              </Row>
            </div>
          </Section>

          {/* ───── Cards ───── */}
          <Section title="Card">
            <div className="grid gap-4 md:grid-cols-2">
              <Card variant="flat">
                <CardHeader>
                  <CardTitle>Flat</CardTitle>
                  <Badge variant="outline">variant</Badge>
                </CardHeader>
                <CardDescription>
                  Transparent surface with a subtle border. Use inside denser layouts.
                </CardDescription>
              </Card>
              <Card variant="elev1">
                <CardHeader>
                  <CardTitle>Elevated 1</CardTitle>
                  <Badge variant="outline">variant</Badge>
                </CardHeader>
                <CardDescription>
                  Default panel surface. Soft inner highlight, subtle border.
                </CardDescription>
              </Card>
              <Card variant="elev2">
                <CardHeader>
                  <CardTitle>Elevated 2</CardTitle>
                  <Badge variant="outline">variant</Badge>
                </CardHeader>
                <CardDescription>
                  Stronger border + drop shadow for floating panels.
                </CardDescription>
              </Card>
              <Card variant="glow">
                <CardHeader>
                  <CardTitle>Glow</CardTitle>
                  <Badge variant="mood">accent</Badge>
                </CardHeader>
                <CardDescription>
                  Adds a 30px accent halo. Used for the result hero and primary CTA card.
                </CardDescription>
                <CardFooter>
                  <span className="text-xs font-mono text-[var(--text-low)]">conf 0.84</span>
                  <Button size="sm">View</Button>
                </CardFooter>
              </Card>
              <Card variant="elev1" interactive className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Interactive</CardTitle>
                  <Badge variant="mood">hover me</Badge>
                </CardHeader>
                <CardDescription>
                  Hover lifts the card and tints the border with the current accent.
                </CardDescription>
              </Card>
            </div>
          </Section>

          {/* ───── Tabs ───── */}
          <Section title="Tabs">
            <Tabs defaultValue="lyrics" className="w-full">
              <TabsList>
                <TabsTrigger value="lyrics">
                  <Music size={14} />
                  Lyrics
                </TabsTrigger>
                <TabsTrigger value="audio">
                  <Album size={14} />
                  Audio
                </TabsTrigger>
                <TabsTrigger value="combined">Combined</TabsTrigger>
                <TabsTrigger value="disabled" disabled>
                  Disabled
                </TabsTrigger>
              </TabsList>
              <TabsContent value="lyrics">
                <p className="text-sm text-[var(--text-med)]">
                  Lyrics tab content goes here.
                </p>
              </TabsContent>
              <TabsContent value="audio">
                <p className="text-sm text-[var(--text-med)]">
                  Audio tab content goes here.
                </p>
              </TabsContent>
              <TabsContent value="combined">
                <p className="text-sm text-[var(--text-med)]">
                  Combined view content goes here.
                </p>
              </TabsContent>
            </Tabs>
          </Section>

          {/* ───── Badges ───── */}
          <Section title="Badge">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">default</Badge>
              <Badge variant="mood">euphoric</Badge>
              <Badge variant="mood">melancholic</Badge>
              <Badge variant="outline">outline</Badge>
              <Badge variant="success">success</Badge>
              <Badge variant="warn">warn</Badge>
              <Badge variant="error">error</Badge>
            </div>
          </Section>

          {/* ───── Meters ───── */}
          <Section title="Meter">
            <div className="space-y-4 max-w-md">
              <Meter value={0.82} label="Energy" valueLabel="82%" />
              <Meter value={0.46} label="Sentiment" valueLabel="46%" />
              <Meter value={0.91} label="Confidence" valueLabel="91%" size="sm" />
              <Meter value={progress} label="Custom" valueLabel={`${Math.round(progress * 100)}%`} size="lg" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setProgress(Math.random())}>
                  Randomize
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setProgress(1)}>
                  Max
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setProgress(0)}>
                  Reset
                </Button>
              </div>
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
                <Meter value={0.7} label="success tone" tone="success" valueLabel="70%" />
                <Meter value={0.55} label="warn tone" tone="warn" valueLabel="55%" />
                <Meter value={0.3} label="error tone" tone="error" valueLabel="30%" />
                <Meter value={0.5} label="neutral tone" tone="neutral" valueLabel="50%" />
              </div>
            </div>
          </Section>

          {/* ───── Tooltip ───── */}
          <Section title="Tooltip">
            <div className="flex flex-wrap gap-3">
              <Tooltip content="Top tooltip" side="top">
                <Button variant="secondary">Hover (top)</Button>
              </Tooltip>
              <Tooltip content="Right tooltip" side="right">
                <Button variant="secondary">Hover (right)</Button>
              </Tooltip>
              <Tooltip content="Bottom tooltip" side="bottom">
                <Button variant="secondary">Hover (bottom)</Button>
              </Tooltip>
              <Tooltip content="Detailed: 0.84 confidence · keyword fallback" side="top">
                <Badge variant="mood">hover for details</Badge>
              </Tooltip>
            </div>
          </Section>

          {/* ───── Modal ───── */}
          <Section title="Modal">
            <Modal>
              <ModalTrigger asChild>
                <Button>Open modal</Button>
              </ModalTrigger>
              <ModalContent>
                <ModalHeader>
                  <ModalTitle>Share this analysis</ModalTitle>
                  <ModalDescription>
                    Public links generate an OG image automatically. Anyone with the URL
                    can view the results, but only you can re-run the analysis.
                  </ModalDescription>
                </ModalHeader>
                <div className="rounded-lg bg-[var(--bg-elev2)] border border-[var(--border-subtle)] p-3 font-mono text-xs text-[var(--text-med)] truncate">
                  https://songanalyzer.vercel.app/share/d3-mood-of-bad-guy
                </div>
                <ModalFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button leftIcon={<Share2 size={14} />}>Copy link</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </Section>

          {/* ───── Skeleton ───── */}
          <Section title="Skeleton">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--text-low)]">
                  Inline shimmer
                </p>
                <Skeleton shape="text" className="w-1/2" />
                <Skeleton shape="text" className="w-3/4" />
                <Skeleton shape="text" className="w-2/3" />
                <Skeleton shape="rect" className="h-24" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--text-low)]">
                  Card placeholder
                </p>
                <Card variant="elev1">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton shape="circle" />
                    <div className="flex-1 space-y-2">
                      <Skeleton shape="text" className="w-2/3" />
                      <Skeleton shape="text" className="w-1/3 h-2" />
                    </div>
                  </div>
                  <Skeleton shape="rect" className="h-32 mb-3" />
                  <Skeleton shape="text" />
                  <Skeleton shape="text" className="w-4/5" />
                </Card>
              </div>
            </div>
          </Section>

          {/* ───── Toast ───── */}
          <Section title="Toast (Sonner)">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => toast('Default toast')}>
                Default
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast.success('Analysis complete', { description: 'Mood: Euphoric · Confidence 0.84' })}
              >
                Success
              </Button>
              <Button
                variant="secondary"
                onClick={() => toast.error('Analysis failed', { description: 'HuggingFace timed out — using keyword fallback.' })}
              >
                Error
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast('Share link copied', {
                    description: 'https://songanalyzer.vercel.app/share/abc',
                    action: { label: 'Undo', onClick: () => toast('Undone') },
                  })
                }
              >
                With action
              </Button>
            </div>
          </Section>

          {/* ───── Spectrum ───── */}
          <Section
            title="Spectrum"
            description="Equalizer. SVG, deterministic per seed, animation pauses on prefers-reduced-motion. The `levels` prop switches to controlled mode — bar heights track a 0..1 array (see LiveSpectrum for real AnalyserNode wiring)."
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] h-24 overflow-hidden">
                <Spectrum bars={56} animated />
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] h-16 overflow-hidden">
                <Spectrum bars={96} animated seed={11} />
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] h-16 overflow-hidden">
                <Spectrum bars={32} animated={false} seed={3} />
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elev1)] h-16 overflow-hidden">
                <Spectrum
                  bars={24}
                  levels={[0.1, 0.3, 0.55, 0.8, 0.95, 0.7, 0.45, 0.6, 0.85, 0.5, 0.3, 0.65, 0.9, 0.75, 0.5, 0.35, 0.55, 0.7, 0.4, 0.25, 0.45, 0.3, 0.15, 0.08]}
                />
              </div>
            </div>
          </Section>

          <footer className="pt-8 pb-4 text-center text-xs text-[var(--text-low)] font-mono">
            stream B · v2-overhaul · {new Date().getFullYear()}
          </footer>
        </div>
      </main>
    </TooltipProvider>
  );
}
