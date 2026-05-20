'use client';

import { useRef, useState, useCallback } from 'react';
import { Card } from './ui/Card';
import { cn } from '@/lib/cn';

const ACCEPTED_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'video/mp4', // mp4 audio-only files often report as video/mp4
];

const ACCEPTED_EXTENSIONS = '.mp3,.mp4,.m4a,.aac,.ogg,.wav,.webm';

interface AudioUploadProps {
  onFileSelected: (file: File) => void;
  loading: boolean;
  error: string;
  fileName: string | null;
}

export default function AudioUpload({
  onFileSelected,
  loading,
  error,
  fileName,
}: AudioUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
      const validExt = ACCEPTED_EXTENSIONS.split(',').includes(ext);
      const validMime = ACCEPTED_TYPES.includes(file.type);
      if (!validMime && !validExt) return;
      onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload audio file"
        className={cn(
          'cursor-pointer rounded-2xl border border-dashed p-10 text-center',
          'transition-[background,border-color,box-shadow] duration-200',
          '[transition-timing-function:var(--ease-out)]',
          'focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2',
          dragOver
            ? 'border-[var(--accent-from)] bg-[color-mix(in_oklab,var(--accent-from)_8%,var(--bg-elev1))] shadow-[0_0_30px_var(--accent-glow)]'
            : 'border-[var(--border-strong)] bg-[var(--bg-elev1)] hover:border-[color-mix(in_oklab,var(--accent-from)_40%,var(--border-strong))]',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleChange}
          className="hidden"
        />

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elev3)] text-[var(--text-med)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        {fileName ? (
          <>
            <p className="font-display text-base text-[var(--text-hi)] truncate max-w-xs mx-auto">
              {fileName}
            </p>
            <p className="text-xs text-[var(--text-low)] mt-1.5 tracking-wide">
              Click or drop to replace
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-lg text-[var(--text-hi)]">
              Drop an audio file
            </p>
            <p className="text-xs text-[var(--text-low)] mt-1.5 tracking-[0.18em] uppercase">
              MP3 · MP4 · M4A · AAC · OGG · WAV · WebM
            </p>
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-[var(--text-med)]">
          <svg className="animate-spin h-4 w-4 text-[var(--accent-from)]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Analyzing audio…
        </div>
      )}

      {error && (
        <Card variant="flat" className="border-[var(--state-error)] bg-[color-mix(in_oklab,var(--state-error)_10%,transparent)] p-4 animate-fade-in">
          <p className="text-sm text-[var(--state-error)]">{error}</p>
        </Card>
      )}
    </div>
  );
}
