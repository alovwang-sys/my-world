import { Doc, Id } from '../../convex/_generated/dataModel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { MessageInput } from './MessageInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';
import { useEffect, useRef, useState } from 'react';
import { useSendInput } from '../hooks/sendInput';
import { toastOnError } from '../toasts';

export function Messages({
  worldId,
  engineId,
  conversation,
  inConversationWithMe,
  humanPlayer,
  scrollViewRef,
  replyPending = false,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  conversation:
    | { kind: 'active'; doc: Conversation }
    | { kind: 'archived'; doc: Doc<'archivedConversations'> };
  inConversationWithMe: boolean;
  humanPlayer?: Player;
  scrollViewRef: React.RefObject<HTMLDivElement>;
  replyPending?: boolean;
}) {
  const messages = useQuery(api.messages.listMessages, {
    worldId,
    conversationId: conversation.doc.id,
  });
  const descriptions = useQuery(api.world.gameDescriptions, { worldId });
  const typing = conversation.kind === 'active' ? conversation.doc.isTyping : undefined;
  const replyError = conversation.kind === 'active' ? conversation.doc.replyError : undefined;
  const retryReply = useSendInput(engineId, 'retryReply');
  const [retrying, setRetrying] = useState(false);
  const isTyping =
    replyPending ||
    (typing &&
      typing.playerId !== humanPlayer?.id &&
      !messages?.some((m) => m.messageUuid === typing.messageUuid));
  const typingName = descriptions?.playerDescriptions.find(
    (p) => p.playerId === typing?.playerId,
  )?.name;
  const pinned = useRef(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const handleRetry = async () => {
    if (retrying || !humanPlayer || !inConversationWithMe || conversation.kind !== 'active') return;
    setRetrying(true);
    try {
      await toastOnError(
        retryReply({ playerId: humanPlayer.id, conversationId: conversation.doc.id }),
      );
    } catch {
      /* The toast explains the rejected retry. */
    } finally {
      setRetrying(false);
    }
  };
  useEffect(() => {
    pinned.current = true;
    setHasNewMessages(false);
  }, [conversation.doc.id]);
  useEffect(() => {
    const scrollView = scrollViewRef.current;
    if (!scrollView) return;
    if (pinned.current) scrollView.scrollTop = scrollView.scrollHeight;
    else setHasNewMessages(true);
  }, [messages, isTyping, scrollViewRef]);
  return (
    <div className="town-conversation">
      <div
        className="town-messages"
        ref={scrollViewRef}
        role="log"
        aria-label="聊天记录"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (pinned.current) setHasNewMessages(false);
        }}
      >
        <p className="town-system-message">
          {conversation.kind === 'archived' ? '上次的聊天 · 已结束' : '对话已开始 · 想聊什么都可以'}
        </p>
        {messages === undefined && <p className="town-system-message">正在读取聊天…</p>}
        {messages?.map((m) => (
          <div
            key={m._id}
            className={`town-message ${m.author === humanPlayer?.id ? 'town-message-mine' : ''}`}
          >
            <div className="town-message-meta">
              <span>{m.author === humanPlayer?.id ? '你' : m.authorName}</span>
              <time dateTime={new Date(m._creationTime).toISOString()}>
                {new Date(m._creationTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <p>{m.text}</p>
          </div>
        ))}
        {isTyping && (
          <p className="town-typing" role="status">
            {typingName ?? '对方'} 正在回复<span aria-hidden="true">…</span>
          </p>
        )}
        {replyError && (
          <div className="town-reply-error" role="alert">
            <p>{replyError}</p>
            {humanPlayer && inConversationWithMe && (
              <button
                className="town-button"
                disabled={retrying}
                onClick={() => void handleRetry()}
              >
                {retrying ? '正在重试…' : '重试回复'}
              </button>
            )}
          </div>
        )}
        {messages?.length === 0 && !isTyping && (
          <p className="town-system-message">用一句 Hello 开始吧。</p>
        )}
      </div>
      {hasNewMessages && (
        <button
          className="town-latest"
          onClick={() => {
            if (scrollViewRef.current)
              scrollViewRef.current.scrollTop = scrollViewRef.current.scrollHeight;
            pinned.current = true;
            setHasNewMessages(false);
          }}
        >
          ↓ 查看最新消息
        </button>
      )}
      {humanPlayer && inConversationWithMe && conversation.kind === 'active' && (
        <MessageInput
          key={conversation.doc.id}
          worldId={worldId}
          engineId={engineId}
          conversation={conversation.doc}
          humanPlayer={humanPlayer}
        />
      )}
    </div>
  );
}
