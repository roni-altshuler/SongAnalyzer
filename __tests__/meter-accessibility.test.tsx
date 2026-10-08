// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Meter } from '@/app/components/ui/Meter';

afterEach(cleanup);

it('names the actual progressbar when existing callers supply native aria attributes', () => {
  const { container } = render(<Meter value={0.55} aria-label="Analysis confidence" />);
  expect(screen.getByRole('progressbar', { name: 'Analysis confidence' }).getAttribute('aria-valuenow')).toBe('55');
  expect(container.firstElementChild?.hasAttribute('aria-label')).toBe(false);
});
