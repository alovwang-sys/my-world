import { Game } from './game';
import { Agent } from './agent';
import { AgentDescription } from './agentDescription';
import { Id } from '../_generated/dataModel';
import { parseGameId } from './ids';
import { ACTION_TIMEOUT } from '../constants';
import { MutationCtx } from '../_generated/server';
import { enqueueMessage } from './messageSubmission';
import {
  recentMemory,
  disabledMemory,
  recordConversation,
  evidenceMessages,
  memoryInstructions,
  readMemory,
} from '../agent/conversationMemory';
import { jest } from '@jest/globals';

const worldId = 'world' as Id<'worlds'>;
const human = parseGameId('players', 'p:1');
const npc = parseGameId('players', 'p:2');
const outsider = parseGameId('players', 'p:3');
const agentId = parseGameId('agents', 'a:4');
const now = 1000000;
function makeGame() {
  return new Game(
    { _id: 'engine' as Id<'engines'>, _creationTime: 0, generationNumber: 0, running: true },
    worldId,
    {
      world: {
        nextId: 10,
        agents: [],
        conversations: [],
        players: [human, npc, outsider].map((id) => ({
          id,
          human: id === human ? 'Me' : undefined,
          lastInput: now,
          position: { x: id === human ? 1 : 2, y: 1 },
          facing: { dx: 1, dy: 0 },
          speed: 0,
        })),
      },
      playerDescriptions: [],
      agentDescriptions: [],
      worldMap: {
        width: 4,
        height: 4,
        tileDim: 32,
        tileSetUrl: '',
        tileSetDimX: 32,
        tileSetDimY: 32,
        bgTiles: [],
        objectTiles: [],
        animatedSprites: [],
      },
    },
  );
}
function start(game: Game, timestamp = now) {
  const id = game.handleInput(timestamp, 'startConversation', { playerId: human, invitee: npc });
  game.handleInput(timestamp + 1, 'acceptInvite', { playerId: npc, conversationId: id });
  game.world.conversations.get(id)!.tick(game, timestamp + 2);
  return id;
}
function addAgent(game: Game, conversationId: string, started = now) {
  const agent = new Agent({
    id: agentId,
    playerId: npc,
    inProgressOperation: {
      name: 'agentGenerateMessage',
      operationId: 'o:20',
      started,
      conversationId,
      messageUuid: 'npc-reply',
    },
  });
  game.world.agents.set(agentId, agent);
  return agent;
}

// An in-memory DB boundary; all game handlers, enqueue, archive and recall logic are real.
function database(game: Game) {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    worlds: [{ _id: worldId, ...game.world.serialize() }],
    engines: [game.engine],
    worldStatus: [{ worldId, engineId: game.engine._id }],
    agentDescriptions: [...game.agentDescriptions.values()].map((d) => ({
      worldId,
      ...d.serialize(),
    })),
    playerDescriptions: [human, npc].map((id) => ({
      worldId,
      playerId: id,
      name: id === human ? 'Me' : 'Emma',
    })),
  };
  for (const [table, rows] of Object.entries(tables)) {
    rows.forEach((row, index) => {
      row._id ??= `${table}-seed-${index}`;
      row._creationTime ??= 0;
    });
  }
  let count = 0;
  const db = {
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    insert: async (table: string, data: Record<string, unknown>) => {
      const id = `${table}-${count++}`;
      (tables[table] ??= []).push({ _id: id, _creationTime: count, ...data });
      return id;
    },
    patch: async (id: string, data: Record<string, unknown>) =>
      Object.assign((await db.get(id))!, data),
    replace: async (id: string, data: Record<string, unknown>) => {
      const row = (await db.get(id))!;
      const creationTime = row._creationTime;
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, { _id: id, _creationTime: creationTime, ...data });
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const chain = {
        withIndex: (
          _name: string,
          filter: (q: { eq: (key: string, value: unknown) => unknown }) => unknown,
        ) => {
          const q = {
            eq: (key: string, value: unknown) => {
              rows = rows.filter((row) => row[key] === value);
              return q;
            },
          };
          filter(q);
          return chain;
        },
        order: (direction: string) => {
          rows.sort(
            (a, b) => Number(a.ended ?? a._creationTime) - Number(b.ended ?? b._creationTime),
          );
          if (direction === 'desc') rows.reverse();
          return chain;
        },
        unique: async () => {
          if (rows.length > 1) throw new Error('duplicate');
          return rows[0] ?? null;
        },
        first: async () => rows[0] ?? null,
        take: async (limit: number) => rows.slice(0, limit),
      };
      return chain;
    },
  };
  const ctx = { db, scheduler: { runAfter: jest.fn() } } as unknown as MutationCtx;
  return { ctx, tables };
}

test('confirmed messages and final archive survive a conversation created and ended in one step', async () => {
  const game = makeGame();
  const { ctx, tables } = database(game);
  const id = start(game);
  const args = {
    playerId: human,
    conversationId: id,
    messageUuid: 'preference',
    text: 'I prefer iced tea without sugar.',
  };
  game.handleInput(now + 3, 'finishSendingMessage', args);
  game.handleInput(now + 4, 'finishSendingMessage', args);
  expect(game.world.conversations.get(id)!.numMessages).toBe(1);
  expect(tables.messages).toBeUndefined();
  game.handleInput(now + 5, 'leaveConversation', { playerId: human, conversationId: id });
  const diff = game.takeDiff();
  await Game.saveDiff(ctx, worldId, diff);
  expect(tables.messages).toHaveLength(1);
  expect(tables.archivedConversations[0]).toMatchObject({
    id,
    numMessages: 1,
    ended: now + 5,
    confirmationVersion: 1,
    lastMessage: { author: human, timestamp: now + 3 },
  });
  expect(tables.participatedTogether).toHaveLength(2);
  await recordConversation(ctx, worldId, diff.endedConversations[0]);
  expect(tables.participatedTogether).toHaveLength(2);
});

test('pending and committed duplicate submissions return the same receipt; conflicting UUID is rejected', async () => {
  const game = makeGame();
  const { ctx, tables } = database(game);
  const id = start(game);
  const args = {
    worldId,
    playerId: human,
    conversationId: id,
    messageUuid: 'same',
    text: 'I like tea.',
  };
  const first = await enqueueMessage(ctx, args);
  expect(await enqueueMessage(ctx, args)).toEqual(first);
  expect(tables.inputs).toHaveLength(1);
  expect(tables.messages).toBeUndefined();
  await expect(enqueueMessage(ctx, { ...args, text: 'Changed' })).rejects.toThrow('提交标识');
  game.handleInput(now + 3, 'finishSendingMessage', args);
  await Game.saveDiff(ctx, worldId, game.takeDiff());
  expect(await enqueueMessage(ctx, args)).toEqual({ kind: 'confirmed', messageUuid: 'same' });
  expect(tables.messages).toHaveLength(1);
});

test('invalid member, unfinished invitation and invalid text do not mutate conversation or accepted history', () => {
  const game = makeGame();
  const id = game.handleInput(now, 'startConversation', { playerId: human, invitee: npc });
  const args = { playerId: human, conversationId: id, messageUuid: 'bad', text: 'Hi' };
  expect(() => game.handleInput(now + 1, 'finishSendingMessage', args)).toThrow();
  game.handleInput(now + 2, 'acceptInvite', { playerId: npc, conversationId: id });
  game.world.conversations.get(id)!.tick(game, now + 3);
  expect(() =>
    game.handleInput(now + 4, 'finishSendingMessage', { ...args, playerId: outsider }),
  ).toThrow();
  expect(() =>
    game.handleInput(now + 4, 'finishSendingMessage', { ...args, text: ' '.repeat(2) }),
  ).toThrow();
  expect(game.acceptedMessages).toHaveLength(0);
  expect(game.world.conversations.get(id)!.numMessages).toBe(0);
});

test('late reply cannot enter a new conversation or clear its current operation', () => {
  const game = makeGame();
  const oldId = start(game);
  const agent = addAgent(game, oldId);
  game.handleInput(now + 3, 'leaveConversation', { playerId: human, conversationId: oldId });
  expect(agent.inProgressOperation).toBeUndefined();
  const newId = start(game, now + 10);
  agent.inProgressOperation = {
    name: 'agentGenerateMessage',
    operationId: 'o:21',
    started: now + 10,
    conversationId: newId,
    messageUuid: 'new',
  };
  const late = {
    agentId,
    playerId: npc,
    conversationId: oldId,
    operationId: 'o:20',
    messageUuid: 'npc-reply',
    text: 'Late',
    leaveConversation: false,
  };
  expect(() => game.handleInput(now + 12, 'agentFinishSendingMessage', late)).toThrow();
  expect(() =>
    game.handleInput(now + 12, 'agentFinishSendingMessage', { ...late, conversationId: newId }),
  ).toThrow();
  expect(agent.inProgressOperation?.operationId).toBe('o:21');
  expect(game.acceptedMessages).toHaveLength(0);
});

test('expired NPC reply is rejected before changing typing or operation; valid final reply is archived', () => {
  const game = makeGame();
  const id = start(game);
  const agent = addAgent(game, id);
  const args = {
    agentId,
    playerId: npc,
    conversationId: id,
    operationId: 'o:20',
    messageUuid: 'npc-reply',
    text: 'Goodbye',
    leaveConversation: true,
  };
  expect(() => game.handleInput(now + ACTION_TIMEOUT, 'agentFinishSendingMessage', args)).toThrow(
    'Expired',
  );
  expect(agent.inProgressOperation).toBeDefined();
  expect(game.acceptedMessages).toHaveLength(0);
  game.handleInput(now + 4, 'agentFinishSendingMessage', args);
  expect(game.endedConversations[0]).toMatchObject({
    numMessages: 1,
    lastMessage: { author: npc, timestamp: now + 4 },
  });
  expect(() => game.handleInput(now + 5, 'agentFinishSendingMessage', args)).toThrow();
  expect(game.acceptedMessages).toHaveLength(1);
});

test('recent/off plugins preserve original evidence, isolate world and owner, and omit legacy messages', async () => {
  const game = makeGame();
  const { ctx, tables } = database(game);
  const id = start(game);
  game.handleInput(now + 3, 'finishSendingMessage', {
    playerId: human,
    conversationId: id,
    messageUuid: 'real',
    text: 'I like tea, not coffee.',
  });
  game.handleInput(now + 4, 'leaveConversation', { playerId: human, conversationId: id });
  await Game.saveDiff(ctx, worldId, game.takeDiff());
  tables.messages.push({
    worldId,
    conversationId: id,
    author: human,
    text: 'I like coffee.',
    messageUuid: 'legacy',
    _creationTime: 999,
  });
  const request = { worldId, ownerPlayerId: npc, otherPlayerId: human };
  const memories = await recentMemory.recall(ctx.db, request);
  expect(memories[0].messages).toEqual([
    expect.objectContaining({
      messageUuid: 'real',
      authorName: 'Me',
      text: 'I like tea, not coffee.',
    }),
  ]);
  expect(await disabledMemory.recall(ctx.db, request)).toEqual([]);
  expect(await recentMemory.recall(ctx.db, request)).toEqual(memories);
  expect(await recentMemory.recall(ctx.db, { ...request, ownerPlayerId: outsider })).toEqual([]);
  expect(
    await recentMemory.recall(ctx.db, { ...request, worldId: 'another-world' as Id<'worlds'> }),
  ).toEqual([]);
  expect(await recentMemory.recall(ctx.db, { ...request, currentConversationId: id })).toEqual([]);
  const serialized = evidenceMessages({ status: 'ok', mode: 'recent', memories });
  expect(serialized[0].role).toBe('user');
  expect(JSON.parse(serialized[0].content).conversations[0].conversationId).toBe(id);
  expect(memoryInstructions({ status: 'disabled', mode: 'off', memories: [] }).join(' ')).toContain(
    'switched off',
  );
  expect(
    memoryInstructions({ status: 'unavailable', mode: 'recent', memories: [] }).join(' '),
  ).toContain('could not be loaded');
});

test('recall clamps long history and rejects forged participant links', async () => {
  const game = makeGame();
  const { ctx, tables } = database(game);
  const id = start(game);
  for (let i = 0; i < 25; i++)
    game.handleInput(now + 3 + i, 'finishSendingMessage', {
      playerId: human,
      conversationId: id,
      messageUuid: `long-${i}`,
      text: 'x'.repeat(500),
    });
  game.handleInput(now + 30, 'leaveConversation', { playerId: human, conversationId: id });
  await Game.saveDiff(ctx, worldId, game.takeDiff());
  const memories = await recentMemory.recall(ctx.db, { worldId, ownerPlayerId: npc });
  expect(memories[0].truncated).toBe(true);
  expect(
    memories.flatMap((m) => m.messages).reduce((n, m) => n + m.text.length, 0),
  ).toBeLessThanOrEqual(4000);
  tables.participatedTogether.push({
    worldId,
    player1: outsider,
    player2: human,
    conversationId: id,
    ended: now + 30,
  });
  expect(await recentMemory.recall(ctx.db, { worldId, ownerPlayerId: outsider })).toEqual([]);
});

test('switching a character off and back on preserves recorded history and cancels old generation', async () => {
  const game = makeGame();
  const id = start(game);
  const agent = addAgent(game, id);
  game.agentDescriptions.set(
    agentId,
    new AgentDescription({ agentId, identity: 'Emma', plan: 'Chat' }),
  );
  const { ctx, tables } = database(game);
  game.handleInput(now + 3, 'finishSendingMessage', {
    playerId: human,
    conversationId: id,
    messageUuid: 'recorded',
    text: 'I like jasmine tea.',
  });
  game.handleInput(now + 4, 'leaveConversation', { playerId: human, conversationId: id });
  await Game.saveDiff(ctx, worldId, game.takeDiff());
  const request = { worldId, ownerPlayerId: npc, otherPlayerId: human };
  expect((await readMemory(ctx.db, request)).memories).toHaveLength(1);
  const current = start(game, now + 10);
  agent.inProgressOperation = {
    name: 'agentGenerateMessage',
    operationId: 'o:21',
    started: now + 10,
    conversationId: current,
    messageUuid: 'inflight',
  };
  game.handleInput(now + 13, 'setMemoryMode', { playerId: human, agentId, mode: 'off' });
  expect(agent.inProgressOperation).toBeUndefined();
  await Game.saveDiff(ctx, worldId, game.takeDiff());
  expect(await readMemory(ctx.db, request)).toMatchObject({ status: 'disabled', memories: [] });
  expect(tables.messages).toHaveLength(1);
  game.handleInput(now + 14, 'setMemoryMode', { playerId: human, agentId, mode: 'recent' });
  await Game.saveDiff(ctx, worldId, game.takeDiff());
  expect((await readMemory(ctx.db, request)).memories[0].messages[0].messageUuid).toBe('recorded');
});

test('NPC waits for a human after answering instead of repeating the same answer', () => {
  const game = makeGame();
  const id = start(game);
  const agent = addAgent(game, id);
  game.handleInput(now + 3, 'agentFinishSendingMessage', {
    agentId,
    playerId: npc,
    conversationId: id,
    operationId: 'o:20',
    messageUuid: 'npc-reply',
    text: 'Hello!',
    leaveConversation: false,
  });
  agent.tick(game, now + 70000);
  expect(agent.inProgressOperation).toBeUndefined();
  expect(game.pendingOperations).toHaveLength(0);
});

test('reply failure releases the operation, persists an error, and retries without another message', () => {
  const game = makeGame();
  const id = start(game);
  game.handleInput(now + 3, 'finishSendingMessage', {
    playerId: human,
    conversationId: id,
    messageUuid: 'question',
    text: 'Hello?',
  });
  const agent = addAgent(game, id);
  const conversation = game.world.conversations.get(id)!;
  conversation.setIsTyping(now + 4, game.world.players.get(npc)!, 'npc-reply');
  const failure = {
    agentId,
    conversationId: id,
    operationId: 'o:20',
    messageUuid: 'npc-reply',
    reason: 'network' as const,
  };
  game.handleInput(now + 5, 'agentMessageFailed', { ...failure, messageUuid: 'stale' });
  expect(agent.inProgressOperation).toBeDefined();
  game.handleInput(now + 6, 'agentMessageFailed', failure);
  expect(agent.inProgressOperation).toBeUndefined();
  expect(conversation.isTyping).toBeUndefined();
  expect(conversation.serialize().replyError).toContain('连接不上');
  agent.tick(game, now + 7000);
  expect(game.pendingOperations).toHaveLength(0);
  expect(() =>
    game.handleInput(now + 7001, 'retryReply', { playerId: outsider, conversationId: id }),
  ).toThrow();
  game.handleInput(now + 7002, 'retryReply', { playerId: human, conversationId: id });
  agent.tick(game, now + 7003);
  expect(agent.inProgressOperation?.name).toBe('agentGenerateMessage');
  expect(game.acceptedMessages).toHaveLength(1);
  // Old failures cannot cancel the retry or change its visible state.
  game.handleInput(now + 7004, 'agentMessageFailed', failure);
  expect(conversation.replyError).toBeUndefined();
  expect(agent.inProgressOperation).toBeDefined();
});

test('reply deadline shows an error and a new human message resumes the NPC', () => {
  const game = makeGame();
  const id = start(game);
  const agent = addAgent(game, id);
  agent.tick(game, now + ACTION_TIMEOUT);
  expect(game.world.conversations.get(id)?.replyError).toContain('超时');
  expect(agent.inProgressOperation).toBeUndefined();
  game.handleInput(now + ACTION_TIMEOUT + 1, 'finishSendingMessage', {
    playerId: human,
    conversationId: id,
    messageUuid: 'new-question',
    text: 'Can we try again?',
  });
  agent.tick(game, now + ACTION_TIMEOUT + 3000);
  expect(game.world.conversations.get(id)?.replyError).toBeUndefined();
  expect(agent.inProgressOperation?.name).toBe('agentGenerateMessage');
  expect(game.acceptedMessages).toHaveLength(1);
});
