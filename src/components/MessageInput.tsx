import { useMutation } from 'convex/react';
import { useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSendInput } from '../hooks/sendInput';
import { Player } from '../../convex/aiTown/player';
import { Conversation } from '../../convex/aiTown/conversation';

export function MessageInput({
  worldId,
  engineId,
  humanPlayer,
  conversation,
}: {
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  humanPlayer: Player;
  conversation: Conversation;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inflightUuid = useRef<string>();
  const submitting = useRef(false);
  const composing = useRef(false);
  const writeMessage = useMutation(api.messages.writeMessage);
  const startTyping = useSendInput(engineId, 'startTyping');

  const send = async () => {
    const text = draft.trim();
    if (!text || submitting.current || composing.current) return;
    submitting.current = true;
    setSending(true);
    setError('');
    const typing = conversation.isTyping;
    const messageUuid =
      typing?.playerId === humanPlayer.id
        ? typing.messageUuid
        : (inflightUuid.current ?? crypto.randomUUID());
    try {
      await writeMessage({
        worldId,
        playerId: humanPlayer.id,
        conversationId: conversation.id,
        text,
        messageUuid,
      });
      setDraft('');
    } catch {
      setError('发送失败，内容已保留，请重试。');
    } finally {
      submitting.current = false;
      setSending(false);
      inputRef.current?.focus();
    }
  };
  return (
    <form
      className="town-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <label htmlFor="town-message">轮到你了</label>
      <textarea
        id="town-message"
        ref={inputRef}
        rows={2}
        autoFocus
        placeholder="想聊什么？用英语打个招呼吧…"
        value={draft}
        readOnly={sending}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          setError('');
          if (!e.target.value || conversation.isTyping || inflightUuid.current) return;
          const messageUuid = crypto.randomUUID();
          inflightUuid.current = messageUuid;
          void startTyping({
            playerId: humanPlayer.id,
            conversationId: conversation.id,
            messageUuid,
          })
            .catch(() => {
              /* Typing is optional; sending remains available. */
            })
            .finally(() => {
              inflightUuid.current = undefined;
            });
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            !composing.current &&
            e.keyCode !== 229
          ) {
            e.preventDefault();
            void send();
          }
        }}
      />
      {error && (
        <p className="town-error" role="alert">
          {error}
        </p>
      )}
      <div className="town-composer-footer">
        <span>Enter 发送 · Shift + Enter 换行</span>
        <button
          type="submit"
          className="town-button town-button-primary"
          disabled={sending || !draft.trim()}
        >
          {sending ? '发送中…' : '发送 ↗'}
        </button>
      </div>
    </form>
  );
}
