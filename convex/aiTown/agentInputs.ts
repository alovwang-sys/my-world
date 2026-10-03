import { v } from 'convex/values';
import { agentId, conversationId, parseGameId } from './ids';
import { Player, activity } from './player';
import { Conversation, conversationInputs } from './conversation';
import { movePlayer } from './movement';
import { inputHandler } from './inputHandler';
import { point } from '../util/types';
import { Descriptions } from '../../data/characters';
import { AgentDescription } from './agentDescription';
import { Agent } from './agent';
import { messageFields } from './messageSubmission';
import { ACTION_TIMEOUT } from '../constants';
import { memoryMode } from '../agent/conversationMemory';

export const agentInputs = {
  agentMessageFailed: inputHandler({
    args: {
      agentId,
      conversationId,
      operationId: v.string(),
      messageUuid: v.string(),
      reason: v.union(v.literal('network'), v.literal('service')),
    },
    handler: (game, now, args): null => {
      const agent = game.world.agents.get(parseGameId('agents', args.agentId));
      const operation = agent?.inProgressOperation;
      const conversation = game.world.conversations.get(
        parseGameId('conversations', args.conversationId),
      );
      if (
        !agent ||
        !conversation ||
        operation?.name !== 'agentGenerateMessage' ||
        operation.operationId !== args.operationId ||
        operation.conversationId !== args.conversationId ||
        operation.messageUuid !== args.messageUuid ||
        conversation.participants.get(agent.playerId)?.status.kind !== 'participating'
      )
        return null;
      delete agent.inProgressOperation;
      if (conversation.isTyping?.playerId === agent.playerId) delete conversation.isTyping;
      conversation.replyError =
        args.reason === 'network'
          ? '暂时连接不上模型服务。你的消息已保存，可以重试回复。'
          : '模型服务暂时无法回复。你的消息已保存，可以重试回复。';
      return null;
    },
  }),
  finishRememberConversation: inputHandler({
    args: {
      operationId: v.string(),
      agentId,
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} isn't remembering ${args.operationId}`);
      } else {
        delete agent.inProgressOperation;
        delete agent.toRemember;
      }
      return null;
    },
  }),
  finishDoSomething: inputHandler({
    args: {
      operationId: v.string(),
      agentId: v.id('agents'),
      destination: v.optional(point),
      invitee: v.optional(v.id('players')),
      activity: v.optional(activity),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      if (
        !agent.inProgressOperation ||
        agent.inProgressOperation.operationId !== args.operationId
      ) {
        console.debug(`Agent ${agentId} didn't have ${args.operationId} in progress`);
        return null;
      }
      delete agent.inProgressOperation;
      const player = game.world.players.get(agent.playerId)!;
      if (args.invitee) {
        const inviteeId = parseGameId('players', args.invitee);
        const invitee = game.world.players.get(inviteeId);
        if (!invitee) {
          throw new Error(`Couldn't find player: ${inviteeId}`);
        }
        Conversation.start(game, now, player, invitee);
        agent.lastInviteAttempt = now;
      }
      if (args.destination) {
        movePlayer(game, now, player, args.destination);
      }
      if (args.activity) {
        player.activity = args.activity;
      }
      return null;
    },
  }),
  agentFinishSendingMessage: inputHandler({
    args: {
      agentId,
      ...messageFields,
      operationId: v.string(),
      leaveConversation: v.boolean(),
    },
    handler: (game, now, args) => {
      const agentId = parseGameId('agents', args.agentId);
      const agent = game.world.agents.get(agentId);
      if (!agent) {
        throw new Error(`Couldn't find agent: ${agentId}`);
      }
      const player = game.world.players.get(agent.playerId);
      if (!player) {
        throw new Error(`Couldn't find player: ${agent.playerId}`);
      }
      const conversationId = parseGameId('conversations', args.conversationId);
      const conversation = game.world.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Couldn't find conversation: ${conversationId}`);
      }
      const operation = agent.inProgressOperation;
      if (
        agent.playerId !== args.playerId ||
        !operation ||
        operation.name !== 'agentGenerateMessage' ||
        operation.operationId !== args.operationId ||
        operation.conversationId !== args.conversationId ||
        operation.messageUuid !== args.messageUuid ||
        now >= operation.started + ACTION_TIMEOUT
      ) {
        throw new Error('Expired or mismatched NPC reply');
      }
      conversationInputs.finishSendingMessage.handler(game, now, {
        playerId: agent.playerId,
        conversationId: args.conversationId,
        messageUuid: args.messageUuid,
        text: args.text,
      });
      delete agent.inProgressOperation;
      if (args.leaveConversation) {
        conversation.leave(game, now, player);
      }
      return null;
    },
  }),
  setMemoryMode: inputHandler({
    args: { playerId: v.string(), agentId, mode: memoryMode },
    handler: (game, now, args) => {
      if (args.mode !== 'recent' && args.mode !== 'off') throw new Error('Invalid memory mode');
      if (!game.world.players.get(parseGameId('players', args.playerId))?.human)
        throw new Error('Human player required');
      const id = parseGameId('agents', args.agentId);
      const description = game.agentDescriptions.get(id);
      const agent = game.world.agents.get(id);
      if (!description || !agent) throw new Error('Agent not found');
      description.memoryMode = args.mode;
      game.descriptionsModified = true;
      if (agent.inProgressOperation?.name === 'agentGenerateMessage') {
        delete agent.inProgressOperation;
        const npc = game.world.players.get(agent.playerId);
        const conversation = npc && game.world.playerConversation(npc);
        if (conversation?.isTyping?.playerId === agent.playerId) delete conversation.isTyping;
      }
      return null;
    },
  }),
  createAgent: inputHandler({
    args: {
      descriptionIndex: v.number(),
    },
    handler: (game, now, args) => {
      const description = Descriptions[args.descriptionIndex];
      const playerId = Player.join(
        game,
        now,
        description.name,
        description.character,
        description.identity,
      );
      const agentId = game.allocId('agents');
      game.world.agents.set(
        agentId,
        new Agent({
          id: agentId,
          playerId: playerId,
          inProgressOperation: undefined,
          lastConversation: undefined,
          lastInviteAttempt: undefined,
          toRemember: undefined,
        }),
      );
      game.agentDescriptions.set(
        agentId,
        new AgentDescription({
          agentId: agentId,
          identity: description.identity,
          plan: description.plan,
        }),
      );
      return { agentId };
    },
  }),
};
