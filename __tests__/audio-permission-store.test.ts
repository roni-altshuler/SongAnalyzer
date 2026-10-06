import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAnalysis } from '@/lib/db/analyses';
import { rowToSong, songToInsert } from '@/lib/db/song-store-adapter';
import type { SongRow } from '@/lib/supabase/database.types';
const admin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/admin', () => ({ getAdminSupabase: admin }));
beforeEach(() => vi.clearAllMocks());
describe('audio persistence helper and legacy metadata', () => {
  it.each(['audio', 'combined'] as const)('rejects direct createAnalysis mode %s before DB access', async (mode) => {
    await expect(createAnalysis({ mode, result: { mood: 'Happy' } })).rejects.toThrow('audio_persistence_disabled');
    expect(admin).not.toHaveBeenCalled();
  });
  it('does not expose or overwrite an existing preview URL or invent legacy metadata provenance', () => {
    const row = { id: 'id', title: 'Track', artist: 'Artist', preview_url: 'https://p.scdn.co/preview.mp3', spotify_id: 'spotify', genius_id: 12 } as SongRow;
    const song = rowToSong(row);
    expect(song.previewUrl).toBeUndefined(); expect(song.metadataSource).toBe('catalog'); expect(song.spotifyId).toBe('spotify');
    const insert = songToInsert({ title: 'Track', artist: 'Artist', previewUrl: row.preview_url! });
    expect(insert).not.toHaveProperty('preview_url');
  });
});
