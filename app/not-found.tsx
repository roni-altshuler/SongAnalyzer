import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Spectrum } from '@/app/components/ui/Spectrum';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-6xl items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl space-y-6 text-center">
        <div aria-hidden="true" className="mx-auto h-10 w-32"><Spectrum bars={16} seed={3} className="h-full w-full" /></div>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--text-med)]">404 · Page unavailable</p>
        <h1 className="font-display text-4xl leading-tight">That page isn’t available.</h1>
        <p className="text-sm leading-relaxed text-[var(--text-med)]">This link may be incomplete, or the reading or profile may no longer be available. You can keep exploring from the workbench.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary"><Link href="/">Back to home</Link></Button>
          <Button asChild><Link href="/analyze">Open the workbench</Link></Button>
        </div>
      </Card>
    </main>
  );
}
