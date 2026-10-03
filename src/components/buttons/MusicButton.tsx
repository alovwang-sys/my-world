import { useEffect, useState } from 'react';
import volumeImg from '../../../assets/volume.svg';
import { sound } from '@pixi/sound';
import Button from './Button';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { toastOnError } from '../../toasts';

export default function MusicButton() {
  const musicUrl = useQuery(api.music.getBackgroundMusic);
  const [isPlaying, setPlaying] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!musicUrl) return;
    sound.add('background', musicUrl).loop = true;
    return () => {
      sound.remove('background');
    };
  }, [musicUrl]);
  const toggle = async () => {
    if (!musicUrl || pending) return;
    setPending(true);
    try {
      if (isPlaying) sound.stop('background');
      else await toastOnError(Promise.resolve(sound.play('background')));
      setPlaying(!isPlaying);
    } catch {
      /* Reported by toastOnError. */
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      onClick={() => void toggle()}
      disabled={!musicUrl || pending}
      title={musicUrl ? '背景音乐' : '尚未配置背景音乐'}
      imgUrl={volumeImg}
    >
      {isPlaying ? '关闭音乐' : '开启音乐'}
    </Button>
  );
}
