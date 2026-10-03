import { ConvexReactClient, useConvex } from 'convex/react';
import { InputArgs, InputReturnValue, Inputs } from '../../convex/aiTown/inputs';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export class InputRejectedError extends Error {}

export async function waitForInput(
  convex: ConvexReactClient,
  inputId: Id<'inputs'>,
  signal?: AbortSignal,
) {
  const watch = convex.watchQuery(api.aiTown.main.inputStatus, { inputId });
  let result = watch.localQueryResult();
  if (result === undefined || result === null) {
    let dispose: undefined | (() => void);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: () => void = () => {};
    try {
      await new Promise<void>((resolve, reject) => {
        abort = () => reject(new DOMException('Cancelled', 'AbortError'));
        if (signal?.aborted) {
          abort();
          return;
        }
        signal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => reject(new Error('确认超时，请重试查询原提交。')), 30000);
        const check = () => {
          try {
            result = watch.localQueryResult();
            if (result !== undefined && result !== null) resolve();
          } catch (error) {
            reject(error);
          }
        };
        dispose = watch.onUpdate(check);
        check();
      });
    } finally {
      dispose?.();
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  if (!result) throw new Error(`Input ${inputId} was never processed.`);
  if (result.kind === 'error') throw new InputRejectedError(result.message);
  return result.value;
}

export function useSendInput<Name extends keyof Inputs>(
  engineId: Id<'engines'>,
  name: Name,
): (args: InputArgs<Name>) => Promise<InputReturnValue<Name>> {
  const convex = useConvex();
  return async (args) => {
    const inputId = await convex.mutation(api.world.sendWorldInput, { engineId, name, args });
    return await waitForInput(convex, inputId);
  };
}
