'use client';

import { Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { toast } from '@/app/components/ui/Toast';

interface ShareFooterProps {
  slug: string;
  spotifyUrl?: string | null;
  geniusUrl?: string | null;
}

/**
 * Bottom action row for `/share/[slug]`: copy the public URL plus optional
 * external links to Spotify / Genius when the resolved song has those IDs.
 */
export default function ShareFooter({ slug, spotifyUrl, geniusUrl }: ShareFooterProps) {
  const handleCopy = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/share/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error('Could not copy — copy from the address bar instead');
    }
  };

  return (
    <footer className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-[var(--border-subtle)]">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        leftIcon={<Copy size={14} aria-hidden />}
      >
        Copy link
      </Button>

      {spotifyUrl && (
        <Button asChild variant="ghost" size="sm">
          <a href={spotifyUrl} target="_blank" rel="noopener noreferrer">
            <span className="inline-flex items-center gap-1.5">
              View on Spotify
              <ExternalLink size={14} aria-hidden />
            </span>
          </a>
        </Button>
      )}

      {geniusUrl && (
        <Button asChild variant="ghost" size="sm">
          <a href={geniusUrl} target="_blank" rel="noopener noreferrer">
            <span className="inline-flex items-center gap-1.5">
              View on Genius
              <ExternalLink size={14} aria-hidden />
            </span>
          </a>
        </Button>
      )}
    </footer>
  );
}
