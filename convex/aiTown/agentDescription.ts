import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId } from './ids';
import { memoryMode, MemoryMode } from '../agent/conversationMemory';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  memoryMode: MemoryMode;

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.memoryMode = serialized.memoryMode ?? 'recent';
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan } = this;
    return { agentId, identity, plan, memoryMode: this.memoryMode };
  }
}

export const serializedAgentDescription = {
  agentId,
  identity: v.string(),
  plan: v.string(),
  memoryMode: v.optional(memoryMode),
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;
