// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SimilarSongs from '@/app/components/SimilarSongs';
import TrackExploration from '@/app/components/TrackExploration';
import { useSongAnalysis } from '@/app/hooks/useSongAnalysis';
const decode = vi.hoisted(() => vi.fn());
vi.mock('@/lib/audio/analyze', () => ({ decodeFileToMono: decode, analyzePcmV2: vi.fn() }));
vi.mock('@/lib/audio-analysis', () => ({ analyzeAudioFile: vi.fn() }));
function Flow() {
  const audio = useSongAnalysis();
  return <><SimilarSongs songId="fixture-db-id" onPick={audio.analyzeSong} />
    {audio.song && <TrackExploration song={audio.song} stage={audio.stage} loading={audio.loading} error={audio.error} hasAnalysis={Boolean(audio.analysis)} />}</>;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('a similar selection cannot analyze a Spotify preview whose external IDs were stripped', async () => {
  vi.stubGlobal('React', React);
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ songs: [{ id: 'legacy', title: 'Legacy preview', artist: 'Artist', previewUrl: 'https://p.scdn.co/prohibited.mp3', distance: 0.2 }] })));
  vi.stubGlobal('fetch', fetcher); render(<Flow />);
  fireEvent.click(await screen.findByRole('button', { name: /Legacy preview/ }));
  expect(screen.getByRole('region', { name: 'Explore selected track' }).textContent).toContain('Audio insights unavailable');
  expect(fetcher).toHaveBeenCalledOnce(); expect(fetcher.mock.calls[0][0]).toContain('/similar');
  expect(decode).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull();
});
