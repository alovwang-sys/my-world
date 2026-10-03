import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { MutationCtx } from '../_generated/server';
import { conversationId, playerId } from './ids';
import { insertInput } from './insertInput';
import type { Game } from './game';

export const messageFields = {
  conversationId,
  playerId,
  messageUuid: v.string(),
  text: v.string(),
};

export function validateMessage(text: string, uuid: string) {
  if (!text.trim() || text.length > 2000) throw new Error('消息不能为空，且不能超过 2000 字。');
  if (!uuid || uuid.length > 128) throw new Error('Invalid message UUID');
}

export async function enqueueMessage(
  ctx: MutationCtx,
  args: {
    worldId: Id<'worlds'>;
    conversationId: string;
    playerId: string;
    messageUuid: string;
    text: string;
    agentId?: string;
    operationId?: string;
    leaveConversation?: boolean;
  },
) {
  validateMessage(args.text, args.messageUuid);
  const existing = await ctx.db
    .query('messages')
    .withIndex('submission', (q) =>
      q
        .eq('worldId', args.worldId)
        .eq('conversationId', args.conversationId)
        .eq('messageUuid', args.messageUuid),
    )
    .unique();
  if (existing) {
    if (existing.author !== args.playerId || existing.text !== args.text)
      throw new Error('提交标识已被其他内容使用。');
    if (existing.confirmationVersion !== 1) throw new Error('旧提交不可重用，请重新发送。');
    return { kind: 'confirmed' as const, messageUuid: existing.messageUuid };
  }
  const status = await ctx.db
    .query('worldStatus')
    .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
    .unique();
  if (!status) throw new Error('World not found');
  const submissionKey = JSON.stringify([args.conversationId, args.messageUuid]);
  const pending = await ctx.db
    .query('inputs')
    .withIndex('submission', (q) =>
      q.eq('engineId', status.engineId).eq('submissionKey', submissionKey),
    )
    .unique();
  if (pending) {
    if (
      pending.args.playerId !== args.playerId ||
      pending.args.text !== args.text ||
      pending.args.operationId !== args.operationId
    ) {
      throw new Error('提交标识已被其他内容使用。');
    }
    return { kind: 'queued' as const, inputId: pending._id };
  }
  const { worldId, agentId, operationId, leaveConversation, ...message } = args;
  const world = await ctx.db.get(worldId);
  const player = world?.players.find((p) => p.id === message.playerId);
  if (!player || (!agentId && !player.human)) throw new Error('Invalid message author');
  let inputId: Id<'inputs'>;
  if (agentId) {
    if (!operationId || !world?.agents.some((a) => a.id === agentId && a.playerId === player.id))
      throw new Error('Invalid agent');
    inputId = await insertInput(ctx, worldId, 'agentFinishSendingMessage', {
      ...message,
      agentId,
      operationId,
      leaveConversation: leaveConversation ?? false,
    });
  } else {
    inputId = await insertInput(ctx, worldId, 'finishSendingMessage', message);
  }
  await ctx.db.patch(inputId, { submissionKey });
  return { kind: 'queued' as const, inputId };
}

// Called only after all membership/operation checks, before changing the conversation.
export function acceptMessage(
  game: Game,
  now: number,
  args: {
    conversationId: string;
    playerId: string;
    messageUuid: string;
    text: string;
  },
) {
  validateMessage(args.text, args.messageUuid);
  const existing = game.acceptedMessages.find(
    (m) => m.conversationId === args.conversationId && m.messageUuid === args.messageUuid,
  );
  if (existing) {
    if (existing.author !== args.playerId || existing.text !== args.text)
      throw new Error('Conflicting message');
    return false;
  }
  game.acceptedMessages.push({
    conversationId: args.conversationId,
    messageUuid: args.messageUuid,
    author: args.playerId,
    text: args.text,
    sentAt: now,
    confirmationVersion: 1,
  });
  return true;
}
