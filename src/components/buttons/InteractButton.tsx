import Button from './Button';
import { toast } from 'react-toastify';
import interactImg from '../../../assets/interact.svg';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useState } from 'react';
import { waitForInput } from '../../hooks/sendInput';
import { useServerGame } from '../../hooks/serverGame';

export default function InteractButton() {
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(worldId);
  const token = useQuery(api.world.userStatus, worldId ? { worldId } : 'skip');
  const isPlaying = !!game && [...game.world.players.values()].some((p) => p.human === token);
  const join = useMutation(api.world.joinWorld);
  const leave = useMutation(api.world.leaveWorld);
  const convex = useConvex();
  const [pending, setPending] = useState(false);
  const joinOrLeaveGame = async () => {
    if (!worldId || !game || pending) return;
    setPending(true);
    try {
      if (isPlaying) await leave({ worldId });
      else await waitForInput(convex, await join({ worldId }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '暂时无法进入或离开小镇，请重试。');
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      className={isPlaying ? '' : 'town-button-primary'}
      imgUrl={interactImg}
      onClick={() => void joinOrLeaveGame()}
      disabled={pending || !game}
    >
      {pending ? '请稍等…' : isPlaying ? '退出小镇' : '进入小镇 →'}
    </Button>
  );
}
