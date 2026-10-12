// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TrackExploration from '@/app/components/TrackExploration';

const song = { title: 'Original action demo', artist: 'Demo ensemble', spotifyId: 'action-demo', metadataSource: 'spotify' as const };
const base = { song, stage: 'idle' as const, loading: false, error: '', hasAnalysis: false };
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// JSDOM does not compute closed-details visibility; Chromium tests verify that boundary.
it('offers a direct lyrics handoff and a closed native disclosure for optional audio', () => {
  render(<TrackExploration {...base} />);
  expect(screen.getByRole('link', { name: 'Add lyrics' }).getAttribute('href')).toBe('/analyze?mode=lyrics#lyrics');
  expect((screen.getByText('Audio options').parentElement as HTMLDetailsElement).open).toBe(false);
  fireEvent.click(screen.getByText('Audio options', { exact: true }));
  expect(screen.getByRole('link', { name: 'Analyze a local file' }).getAttribute('href')).toBe('/analyze?mode=audio');
  expect(screen.getByRole('status').textContent).toBe('Audio insights unavailable');
});

it('closes prior optional controls when a different track is selected', () => {
  const view = render(<TrackExploration {...base} />);
  const details = screen.getByText('Audio options').parentElement as HTMLDetailsElement;
  act(() => { details.open = true; });
  view.rerender(<TrackExploration {...base} song={{ ...song, spotifyId: 'other-action', title: 'Another original action demo' }} />);
  expect(details.open).toBe(false);
  expect(screen.getByRole('heading', { name: 'Another original action demo' })).toBeTruthy();
});

it('keeps active loading and errors visible without opening optional controls', () => {
  const view = render(<TrackExploration {...base} loading stage="analyzing" />);
  expect(screen.getByRole('status').textContent).toBe('Reading local audio');
  expect(screen.queryByText('Audio options')).toBeNull();
  view.rerender(<TrackExploration {...base} error="Original controlled decode error" />);
  expect(screen.getByRole('alert').textContent).toBe('Original controlled decode error');
  expect((screen.getByText('Audio options').parentElement as HTMLDetailsElement).open).toBe(false);
});
