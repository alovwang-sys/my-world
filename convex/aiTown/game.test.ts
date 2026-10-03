import { Game } from './game';
import { Id } from '../_generated/dataModel';
import { parseGameId } from './ids';
import { HUMAN_IDLE_TOO_LONG } from '../constants';

// Exercise real inputs and the idle-removal path with a deterministic clock.
test('movement and messages keep a human present; only actual inactivity removes them', () => {
  const now = 1_000_000;
  const playerId = parseGameId('players', 'p:1');
  const npcId = parseGameId('players', 'p:2');
  const conversationId = parseGameId('conversations', 'c:3');
  const game = new Game(
    {
      _id: 'engine' as Id<'engines'>,
      _creationTime: 0,
      generationNumber: 0,
      running: true,
      processedInputNumber: 0,
    },
    'world' as Id<'worlds'>,
    {
      world: {
        nextId: 3,
        agents: [],
        conversations: [],
        players: [
          {
            id: playerId,
            human: 'test-human',
            lastInput: now - HUMAN_IDLE_TOO_LONG + 1,
            position: { x: 1, y: 1 },
            facing: { dx: 1, dy: 0 },
            speed: 0,
          },
          {
            id: npcId,
            lastInput: 0,
            position: { x: 2, y: 1 },
            facing: { dx: -1, dy: 0 },
            speed: 0,
          },
        ],
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
  const human = game.world.players.get(playerId)!;
  game.handleInput(now, 'moveTo', { playerId, destination: { x: 2, y: 2 } });
  human.tick(game, now + 2);
  expect(game.world.players.has(playerId)).toBe(true);
  expect(human.lastInput).toBe(now);

  game.handleInput(now + 10, 'startConversation', { playerId, invitee: npcId });
  game.handleInput(now + 20, 'acceptInvite', { playerId: npcId, conversationId });
  const sentAt = now + HUMAN_IDLE_TOO_LONG - 1;
  game.handleInput(sentAt, 'finishSendingMessage', { playerId, conversationId, timestamp: sentAt });
  human.tick(game, sentAt + 2);
  expect(game.world.players.has(playerId)).toBe(true);
  expect(human.lastInput).toBe(sentAt);

  // A background NPC reply must not keep an idle user around indefinitely.
  game.handleInput(sentAt + 10, 'finishSendingMessage', {
    playerId: npcId,
    conversationId,
    timestamp: sentAt + 10,
  });
  expect(human.lastInput).toBe(sentAt);
  expect(() =>
    game.handleInput(sentAt + 11, 'moveTo', { playerId, destination: { x: 1.5, y: 2 } }),
  ).toThrow();
  expect(human.lastInput).toBe(sentAt);
  human.tick(game, sentAt + HUMAN_IDLE_TOO_LONG + 1);
  expect(game.world.players.has(playerId)).toBe(false);
});
