// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CombinedView from '@/app/components/CombinedView';
import { audioComparisonProjection, lyricsComparisonProjection, describeEstimateDifference } from '@/lib/analysis/comparison';
import { agreementBreakdown, lyricsAffect } from '@/lib/analysis/affect';
import { MOOD_COORDS, type AffectPoint } from '@/lib/audio/mood-map';
import type { AnalysisResult, AudioAnalysisResult, AudioAnalysisResultV2 } from '@/lib/types';

afterEach(cleanup);

// Controlled metadata for projection/rendering contracts, not audio-extraction
// output or evidence of model accuracy. Browser tests use the real audio worker.
const text: AnalysisResult = {
  mood: 'Romantic', vibe: 'Balanced', energy: 'Moderate', sentiment: 'Positive',
  themes: [], detailedAnalysis: '', confidence: 0.55, wordCount: 17,
  engines: { transformer: { status: 'skipped' }, keyword: { status: 'ok' } },
};
const legacyAudio: AudioAnalysisResult = {
  mood: 'Romantic', vibe: 'Mellow', energy: 'Low', sentiment: 'Positive', tempo: 'Slow', bpm: 80,
  characteristics: [], detailedAnalysis: '', confidence: 0.5, duration: 6,
  features: { bpm: 80, rmsEnergy: 0, spectralCentroid: 0, dynamicRange: 0, zeroCrossingRate: 0, duration: 6 },
};
function mir(point: AffectPoint): AudioAnalysisResultV2 {
  // Only coordinates are consumed by this projection contract.
  return { ...legacyAudio, engineVersion: 'v2', v2: point as AudioAnalysisResultV2['v2'] };
}

describe('comparison provenance', () => {
  it('retains the existing known-mood projection for a keyword reading', () => {
    expect(lyricsComparisonProjection(text)).toEqual({ point: MOOD_COORDS.Romantic, basis: 'mood-label' });
  });
  it('retains the weighted transformer projection and identifies its evidence', () => {
    const hybrid: AnalysisResult = { ...text, engines: { transformer: { status: 'ok', scores: [{ label: 'joy', score: 0.2 }, { label: 'sadness', score: 0.8 }] }, keyword: { status: 'ok' } } };
    expect(lyricsComparisonProjection(hybrid)).toEqual({ point: lyricsAffect(hybrid), basis: 'emotion-scores' });
  });
  it('does not treat stale scores on a failed engine as a successful model reading', () => {
    const stale: AnalysisResult = { ...text, engines: { transformer: { status: 'timeout', scores: [{ label: 'joy', score: 1 }] }, keyword: { status: 'ok' } } };
    expect(lyricsComparisonProjection(stale)).toEqual({ point: MOOD_COORDS.Romantic, basis: 'mood-label' });
  });
  it('filters malformed emotion entries before projecting the remaining valid scores', () => {
    const scores = [null, { label: 'joy', score: Infinity }, { label: 'sadness', score: -1 }, { label: 'unrecognized', score: 1 }, { label: 'joy', score: 1 }];
    const result = { ...text, engines: { transformer: { status: 'ok', scores }, keyword: { status: 'ok' } } } as unknown as AnalysisResult;
    expect(lyricsComparisonProjection(result)).toEqual({ point: { valence: 0.85, arousal: 0.55 }, basis: 'emotion-scores' });
  });
  it('withholds coordinates for an unknown text mood instead of manufacturing a neutral point', () => {
    expect(lyricsComparisonProjection({ ...text, mood: 'Unmapped' })).toEqual({ point: null, basis: 'unavailable' });
  });
  it('preserves real supplied signal coordinates, including a valid zero', () => {
    expect(audioComparisonProjection(mir({ valence: 0, arousal: 0 }))).toEqual({ point: { valence: 0, arousal: 0 }, basis: 'signal' });
  });
  it('labels fallback and unversioned audio as a mood mapping rather than signal coordinates', () => {
    expect(audioComparisonProjection({ ...legacyAudio, engineVersion: 'v1-fallback' })).toEqual({ point: MOOD_COORDS.Romantic, basis: 'mood-label' });
    expect(audioComparisonProjection(legacyAudio)).toEqual({ point: MOOD_COORDS.Romantic, basis: 'mood-label' });
  });
  it.each([{ valence: NaN, arousal: 0 }, { valence: 0, arousal: Infinity }, { valence: 1.01, arousal: 0 }, { valence: 0, arousal: -1.01 }])('withholds invalid MIR coordinates %j', point => {
    expect(audioComparisonProjection(mir(point))).toEqual({ point: null, basis: 'unavailable' });
  });
  it('does not quietly relabel missing MIR coordinates as measured signal evidence', () => {
    expect(audioComparisonProjection({ ...legacyAudio, engineVersion: 'v2' })).toEqual({ point: null, basis: 'unavailable' });
  });
  it('describes estimates without claiming a song’s emotional story', () => {
    expect(describeEstimateDifference(agreementBreakdown(MOOD_COORDS.Romantic, MOOD_COORDS.Romantic))).toBe('The two estimates sit close together on this map.');
    expect(describeEstimateDifference(agreementBreakdown({ valence: -1, arousal: 0 }, { valence: 1, arousal: 0 }))).toContain('audio estimate');
    expect(describeEstimateDifference(agreementBreakdown({ valence: 0, arousal: 1 }, { valence: 0, arousal: -1 }))).toContain('lyrics estimate');
  });
});

describe('comparison UI', () => {
  it('identifies separate inputs and makes the percentage’s limits visible even at 100%', () => {
    render(<CombinedView lyricsAnalysis={text} audioAnalysis={mir(MOOD_COORDS.Romantic)} audioFileName="independent-original.wav" />);
    const comparison = screen.getByRole('region', { name: 'Lyrics and audio comparison' });
    expect(within(comparison).getByText('independent-original.wav')).toBeTruthy();
    expect(within(comparison).getByText('17 analyzed words')).toBeTruthy();
    expect(within(comparison).getByText('6.0s analyzed · Signal analysis (v2)')).toBeTruthy();
    expect(within(comparison).getByRole('progressbar', { name: 'Estimated proximity of lyrics and audio' }).getAttribute('aria-valuenow')).toBe('100');
    expect(comparison.textContent).toContain('does not verify they belong to the same song');
    expect(comparison.textContent).toContain('does not measure model accuracy');
    expect(comparison.textContent).not.toContain('same emotional story');
    const mapName = within(comparison).getByRole('img').getAttribute('aria-label');
    expect(mapName).toContain('lyrics circle');
    expect(mapName).toContain('audio diamond');
    expect(within(comparison).getByText('See comparison evidence').tagName).toBe('SUMMARY');
  });
  it('identifies a translated word count as analyzed text rather than supplied text', () => {
    render(<CombinedView lyricsAnalysis={{ ...text, translated: true, originalLanguage: 'Spanish', wordCount: 9 }} audioAnalysis={mir(MOOD_COORDS.Romantic)} />);
    const input = screen.getByRole('group', { name: 'Lyrics comparison input' });
    expect(within(input).getByText('9 analyzed words')).toBeTruthy();
    expect(within(input).getByText('Translated text reading')).toBeTruthy();
    expect(input.textContent).not.toContain('supplied words');
    expect(input.textContent).not.toContain('Supplied text reading');
  });
  it('replaces the old false 100% for two unmapped labels with an unavailable state', () => {
    render(<CombinedView lyricsAnalysis={{ ...text, mood: 'Unmapped text' }} audioAnalysis={{ ...legacyAudio, mood: 'Unmapped audio' }} />);
    expect(screen.getByRole('status').textContent).toContain('both readings');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('100%')).toBeNull();
  });
  it('removes stale comparisons when a replacement result has missing coordinates', () => {
    const { rerender } = render(<CombinedView lyricsAnalysis={text} audioAnalysis={mir(MOOD_COORDS.Romantic)} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<CombinedView lyricsAnalysis={text} audioAnalysis={{ ...legacyAudio, engineVersion: 'v2' }} />);
    expect(screen.getByRole('status').textContent).toContain('the audio reading');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('keeps legacy provenance and unavailable input sizes honest', () => {
    render(<CombinedView lyricsAnalysis={{ ...text, translated: true, wordCount: NaN }} audioAnalysis={{ ...legacyAudio, duration: NaN }} />);
    expect(screen.getByText('Word count unavailable')).toBeTruthy();
    expect(screen.getByText('Translated text reading')).toBeTruthy();
    expect(screen.getByText('Duration unavailable · Engine provenance unavailable')).toBeTruthy();
    expect(screen.getAllByText('Mood label mapped')).toHaveLength(2);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
