import { useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { SelectElement } from './Player';
import { Messages } from './Messages';
import { toastOnError } from '../toasts';
import { useSendInput } from '../hooks/sendInput';
import { GameId } from '../../convex/aiTown/ids';
import { ServerGame } from '../hooks/serverGame';

export default function PlayerDetails({
  worldId,
  engineId,
  game,
  playerId,
  setSelectedElement,
  scrollViewRef,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  playerId?: GameId<'players'>;
  setSelectedElement: SelectElement;
  scrollViewRef: React.RefObject<HTMLDivElement>;
}) {
  const token = useQuery(api.world.userStatus, { worldId });
  const human = [...game.world.players.values()].find((p) => p.human === token);
  const humanConversation = human && game.world.playerConversation(human);
  if (humanConversation)
    playerId = [...humanConversation.participants.keys()].find((id) => id !== human.id);
  const player = playerId && game.world.players.get(playerId);
  const conversation = player && game.world.playerConversation(player);
  const previous = useQuery(
    api.world.previousConversation,
    playerId ? { worldId, playerId } : 'skip',
  );
  const start = useSendInput(engineId, 'startConversation');
  const accept = useSendInput(engineId, 'acceptInvite');
  const reject = useSendInput(engineId, 'rejectInvite');
  const leave = useSendInput(engineId, 'leaveConversation');
  const moveTo = useSendInput(engineId, 'moveTo');
  const [pending, setPending] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(true);
    try {
      await toastOnError(action());
    } catch {
      /* The toast explains the failed action. */
    } finally {
      setPending(false);
    }
  };
  if (!player)
    return (
      <div className="town-empty">
        <span aria-hidden="true">☕</span>
        <h2>今天，想和谁聊聊？</h2>
        <p>
          在上面的居民列表选一个人，
          <br />
          也可以直接点击地图上的角色。
        </p>
        <small>不用按任务走，话题由你决定。</small>
      </div>
    );
  const isMe = player.id === human?.id;
  const name = game.playerDescriptions.get(player.id)?.name ?? '居民';
  const same = humanConversation && humanConversation.id === conversation?.id;
  const humanStatus = human && humanConversation?.participants.get(human.id)?.status.kind;
  const playerStatus = conversation?.participants.get(player.id)?.status.kind;
  const invited = same && humanStatus === 'invited';
  const chatting = !!same && humanStatus === 'participating' && playerStatus === 'participating';
  const canInvite = human && !humanConversation && !conversation && !isMe;
  const status = invited
    ? '邀请你聊聊'
    : chatting
      ? '正在与你聊天'
      : same && playerStatus === 'invited'
        ? '等待对方接受邀请'
        : same
          ? '正在走近，稍等一下'
          : conversation
            ? '正在和别人聊天'
            : isMe
              ? '黄色标记就是你'
              : '可以打个招呼';
  const end = async () => {
    if (human && humanConversation && same)
      await leave({ playerId: human.id, conversationId: humanConversation.id });
    setSelectedElement(undefined);
  };
  return (
    <section className="town-person">
      <header className="town-person-header">
        <div className="town-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </div>
        <div>
          <h2>{isMe ? '你' : name}</h2>
          <p role="status">
            <i className="town-status-dot" />
            {status}
          </p>
        </div>
        <button
          className="town-icon-button"
          aria-label={same ? '结束并关闭对话' : '关闭角色详情'}
          disabled={pending}
          onClick={() => void run(end)}
        >
          ×
        </button>
      </header>
      <div className="town-person-actions">
        {human && !isMe && (!humanConversation || (same && !chatting)) && (
          <button
            className="town-button"
            disabled={pending}
            onClick={() =>
              void run(() =>
                moveTo({
                  playerId: human.id,
                  destination: {
                    x: Math.floor(player.position.x),
                    y: Math.floor(player.position.y),
                  },
                }),
              )
            }
          >
            走到附近
          </button>
        )}
        {canInvite && (
          <button
            className="town-button town-button-primary"
            disabled={pending}
            onClick={() => void run(() => start({ playerId: human.id, invitee: player.id }))}
          >
            {pending ? '邀请中…' : '打个招呼 →'}
          </button>
        )}
        {!human && !isMe && <p>先点击右上角「进入小镇」，就能和 {name} 交流。</p>}
        {invited && human && humanConversation && (
          <>
            <button
              className="town-button town-button-primary"
              disabled={pending}
              onClick={() =>
                void run(() => accept({ playerId: human.id, conversationId: humanConversation.id }))
              }
            >
              接受邀请
            </button>
            <button
              className="town-button"
              disabled={pending}
              onClick={() =>
                void run(() => reject({ playerId: human.id, conversationId: humanConversation.id }))
              }
            >
              暂不接受
            </button>
          </>
        )}
        {same && !invited && (
          <button className="town-button" disabled={pending} onClick={() => void run(end)}>
            {chatting ? '结束对话' : '取消邀请'}
          </button>
        )}
      </div>
      {!isMe && conversation && playerStatus === 'participating' ? (
        <Messages
          key={conversation.id}
          worldId={worldId}
          engineId={engineId}
          inConversationWithMe={chatting}
          conversation={{ kind: 'active', doc: conversation }}
          humanPlayer={human}
          scrollViewRef={scrollViewRef}
        />
      ) : !conversation && previous && !isMe ? (
        <Messages
          key={previous.id}
          worldId={worldId}
          engineId={engineId}
          inConversationWithMe={false}
          conversation={{ kind: 'archived', doc: previous }}
          humanPlayer={human}
          scrollViewRef={scrollViewRef}
        />
      ) : (
        <div className="town-person-placeholder">
          <p>
            {same
              ? '双方碰面后，聊天框会自动出现。距离太远时，可以点击「走到附近」。'
              : isMe
                ? '点击地面走走，再找一位居民聊天吧。'
                : '聊聊今天、兴趣，或小镇里发生的事。'}
          </p>
          {player.activity && player.activity.until > Date.now() && (
            <small>当前活动：{player.activity.description}</small>
          )}
        </div>
      )}
    </section>
  );
}
