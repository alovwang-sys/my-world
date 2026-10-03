import { useConvex, useMutation } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSendInput, waitForInput, InputRejectedError } from '../hooks/sendInput';
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
  const convex = useConvex();
  const submission = useRef<{ uuid: string; text: string; inputId?: Id<'inputs'> }>();
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const writeMessage = useMutation(api.messages.writeMessage);
  const startTyping = useSendInput(engineId, 'startTyping');

  const send = async () => {
    const text = draft.trim();
    if (!text || submitting.current || composing.current) return;
    submitting.current = true;
    setSending(true);
    setError('');
    const attempt =
      submission.current?.text === text ? submission.current : { uuid: crypto.randomUUID(), text };
    submission.current = attempt;
    const abortController = new AbortController();
    controller.current = abortController;
    try {
      const receipt = attempt.inputId
        ? { kind: 'queued' as const, inputId: attempt.inputId }
        : await writeMessage({
            worldId,
            playerId: humanPlayer.id,
            conversationId: conversation.id,
            text,
            messageUuid: attempt.uuid,
          });
      if (receipt.kind === 'queued') {
        attempt.inputId = receipt.inputId;
        await waitForInput(convex, receipt.inputId, abortController.signal);
      }
      if (!abortController.signal.aborted) {
        submission.current = undefined;
        setDraft('');
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        if (error instanceof InputRejectedError) submission.current = undefined;
        setError(
          error instanceof InputRejectedError
            ? `未发送：${error.message} 内容已保留。`
            : '暂未确认发送结果，内容已保留。重试会查询同一次提交。',
        );
      }
    } finally {
      submitting.current = false;
      if (!abortController.signal.aborted) {
        setSending(false);
        inputRef.current?.focus();
      }
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
        maxLength={2000}
        autoFocus
        placeholder="聊聊你的偏好，下一次见面再问她是否记得…"
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
          {sending ? '确认中…' : '发送 ↗'}
        </button>
      </div>
    </form>
  );
}
