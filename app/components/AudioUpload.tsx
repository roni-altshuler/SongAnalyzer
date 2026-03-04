'use client';

import { useRef, useState, useCallback } from 'react';

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
      // Accept by MIME or by extension fallback
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      const validExt = ACCEPTED_EXTENSIONS.split(',').includes(ext);
      const validMime = ACCEPTED_TYPES.includes(file.type);

      if (!validMime && !validExt) {
        return; // silently ignore — browser should prevent via accept attr
      }

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
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors
          ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleChange}
          className="hidden"
        />

        <div className="text-5xl mb-3">🎧</div>

        {fileName ? (
          <>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs mx-auto">
              {fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Click or drop to change file
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Drop an audio file here or click to browse
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              MP3, MP4, M4A, AAC, OGG, WAV, WebM
            </p>
          </>
        )}
      </div>

      {/* Analyze button */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading || !fileName}
        className={`
          w-full font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg
          ${
            fileName
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white hover:shadow-xl active:scale-[0.98]'
              : 'bg-gray-300 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        style={{ display: 'none' }} // button not needed — analysis starts on file select
      >
        Analyze Audio
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-2 text-sm text-gray-600 dark:text-gray-300">
          <svg
            className="animate-spin h-5 w-5 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Analyzing audio — this may take a few seconds…
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-fade-in">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
