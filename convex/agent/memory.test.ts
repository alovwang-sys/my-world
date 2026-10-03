import { jest } from '@jest/globals';
import { recallMemories, rememberConversation } from './memory';
import { ActionCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { GameId } from '../aiTown/ids';

test('disabled vector memory skips both recall and post-conversation model calls', async () => {
  const previous = process.env.VECTOR_MEMORY_ENABLED;
  process.env.VECTOR_MEMORY_ENABLED = 'false';
  const runQuery = jest.fn<ActionCtx['runQuery']>();
  const vectorSearch = jest.fn<ActionCtx['vectorSearch']>();
  const ctx = { runQuery, vectorSearch } as unknown as ActionCtx;
  try {
    expect(await recallMemories(ctx, 'p:1' as GameId<'players'>, 'Coffee', 3)).toEqual([]);
    await rememberConversation(
      ctx,
      'world' as Id<'worlds'>,
      'a:0' as GameId<'agents'>,
      'p:1' as GameId<'players'>,
      'c:0' as GameId<'conversations'>,
    );
    expect(runQuery).not.toHaveBeenCalled();
    expect(vectorSearch).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.VECTOR_MEMORY_ENABLED;
    else process.env.VECTOR_MEMORY_ENABLED = previous;
  }
});
