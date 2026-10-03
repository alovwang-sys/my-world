import { jest } from '@jest/globals';
import { ConvexReactClient } from 'convex/react';
import { Id } from '../../convex/_generated/dataModel';
import { waitForInput, InputRejectedError } from './sendInput';

test('input confirmation resolves a real result and disposes the subscription', async () => {
  let result: unknown = null;
  let update = () => {};
  const dispose = jest.fn();
  const client = {
    watchQuery: () => ({
      localQueryResult: () => result,
      onUpdate: (fn: () => void) => {
        update = fn;
        return dispose;
      },
    }),
  } as unknown as ConvexReactClient;
  const waiting = waitForInput(client, 'input' as Id<'inputs'>);
  result = { kind: 'ok', value: 'confirmed' };
  update();
  expect(await waiting).toBe('confirmed');
  expect(dispose).toHaveBeenCalledTimes(1);
});

test('unmount cancellation disposes an unresolved subscription; rejection stays distinguishable', async () => {
  const dispose = jest.fn();
  const controller = new AbortController();
  const client = {
    watchQuery: () => ({ localQueryResult: () => null, onUpdate: () => dispose }),
  } as unknown as ConvexReactClient;
  const waiting = waitForInput(client, 'input' as Id<'inputs'>, controller.signal);
  controller.abort();
  await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  expect(dispose).toHaveBeenCalledTimes(1);
  const rejected = {
    watchQuery: () => ({ localQueryResult: () => ({ kind: 'error', message: 'Ended' }) }),
  } as unknown as ConvexReactClient;
  await expect(waitForInput(rejected, 'input' as Id<'inputs'>)).rejects.toBeInstanceOf(
    InputRejectedError,
  );
});
