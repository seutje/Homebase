import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAppUpdates } from './useAppUpdates';
import { updates, type AppUpdate } from './updates';
import {
  UpdateBanner,
  UpdateProgress,
  UpdateSettings,
} from '../components/AppUpdates';

function Harness({ automatic = false }: { automatic?: boolean }) {
  const state = useAppUpdates(automatic);
  return (
    <>
      <p>Your tasks stay available</p>
      <UpdateBanner updates={state} />
      <UpdateSettings updates={state} />
      <UpdateProgress updates={state} />
    </>
  );
}
function available() {
  return {
    version: '0.3.0',
    body: 'A useful new release',
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppUpdate;
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('checks once on automatic startup in Strict Mode and suppresses offline errors', async () => {
  vi.useFakeTimers();
  const check = vi
    .spyOn(updates, 'check')
    .mockRejectedValue(new Error('offline'));
  render(
    <StrictMode>
      <Harness automatic />
    </StrictMode>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(check).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('Your tasks stay available')).toBeVisible();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
  });
  expect(check).toHaveBeenCalledTimes(2);
});
it('checks manually, dismisses a release and releases its native resource', async () => {
  const user = userEvent.setup();
  const update = available();
  vi.spyOn(updates, 'check').mockResolvedValue(update);
  const install = vi.spyOn(updates, 'install');
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('Homebase 0.3.0 is available');
  expect(install).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Later' }));
  expect(update.close).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Homebase 0.3.0 is available')).toBeNull();
});
it('shows manual errors and permits retry without disrupting tasks', async () => {
  const user = userEvent.setup();
  vi.spyOn(updates, 'check')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(null);
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Your tasks stay available')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('You are up to date.');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('starts installation only on request, displays progress and recovers from a failed verification', async () => {
  const user = userEvent.setup();
  const update = available();
  vi.spyOn(updates, 'check').mockResolvedValue(update);
  let rejectInstall: (reason: Error) => void = () => {};
  const install = vi
    .spyOn(updates, 'install')
    .mockImplementation((_update, onEvent) => {
      onEvent({ event: 'Started', data: { contentLength: 100 } });
      onEvent({ event: 'Progress', data: { chunkLength: 40 } });
      return new Promise((_resolve, reject) => {
        rejectInstall = reject;
      });
    });
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Check for updates' }));
  await screen.findByText('Homebase 0.3.0 is available');
  expect(install).not.toHaveBeenCalled();
  await user.click(
    screen.getAllByRole('button', { name: 'Install update' })[0],
  );
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '40');
  expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
  await act(async () => rejectInstall(new Error('Invalid signature')));
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
  expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
    'could not be installed',
  );
  expect(
    screen.getAllByRole('button', { name: 'Install update' })[0],
  ).toBeEnabled();
});
