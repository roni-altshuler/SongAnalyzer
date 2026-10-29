// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Modal, ModalContent, ModalDescription, ModalTitle, ModalTrigger } from '@/app/components/ui/Modal';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

for (const guard of ['onPointerDownOutside', 'onInteractOutside'] as const) {
  it(`preserves ${guard} cancellation instead of bypassing it through the backdrop`, async () => {
    const registration = vi.spyOn(document, 'addEventListener');
    const prevent = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <Modal>
        <ModalTrigger>Open guarded dialog</ModalTrigger>
        <ModalContent {...{ [guard]: prevent }}>
          <ModalTitle>Guarded dialog</ModalTitle>
          <ModalDescription>Outside gestures require caller approval.</ModalDescription>
        </ModalContent>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open guarded dialog' }));
    await waitFor(() => expect(registration.mock.calls.some(([type, callback]) =>
      type === 'pointerdown' && typeof callback === 'function' && Function.prototype.toString.call(callback).includes('pointerType'),
    )).toBe(true));
    const backdrop = document.querySelector<HTMLDivElement>('body > div[data-state="open"][aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.pointerDown(backdrop!, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    await waitFor(() => expect(prevent).toHaveBeenCalled());
    fireEvent.click(backdrop!);
    expect(screen.getByRole('dialog', { name: 'Guarded dialog' })).toBeTruthy();
  });
}
