import { useRef, useState } from 'react';
import PixiGame, { CameraRequest } from './PixiGame.tsx';
import { useElementSize } from 'usehooks-ts';
import { Stage } from '@pixi/react';
import { ConvexProvider, useConvex, useQuery } from 'convex/react';
import PlayerDetails from './PlayerDetails.tsx';
import { api } from '../../convex/_generated/api';
import { useWorldHeartbeat } from '../hooks/useWorldHeartbeat.ts';
import { useHistoricalTime } from '../hooks/useHistoricalTime.ts';
import { DebugTimeManager } from './DebugTimeManager.tsx';
import { GameId } from '../../convex/aiTown/ids.ts';
import { useServerGame } from '../hooks/serverGame.ts';

export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;

export default function Game() {
  const convex = useConvex();
  const [selectedElement, setSelectedElement] = useState<{
    kind: 'player';
    id: GameId<'players'>;
  }>();
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>();
  const [gameWrapperRef, { width, height }] = useElementSize();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const engineId = worldStatus?.engineId;
  const game = useServerGame(worldId);
  const token = useQuery(api.world.userStatus, worldId ? { worldId } : 'skip');
  useWorldHeartbeat();
  const worldState = useQuery(api.world.worldState, worldId ? { worldId } : 'skip');
  const { historicalTime, timeManager } = useHistoricalTime(worldState?.engine);
  const scrollViewRef = useRef<HTMLDivElement>(null);
  if (!worldId || !engineId || !game)
    return (
      <div className="town-loading" role="status">
        正在连接小镇…
      </div>
    );
  const players = [...game.world.players.values()];
  const human = players.find((p) => p.human === token);
  const activeConversation = human && game.world.playerConversation(human);
  const activePartner =
    activeConversation && [...activeConversation.participants.keys()].find((id) => id !== human.id);
  const selectedId = activePartner ?? selectedElement?.id;
  const residents = players.filter((p) => !p.human);
  const camera = (kind: CameraRequest['kind'], playerId?: GameId<'players'>) =>
    setCameraRequest({ kind, playerId, sequence: Date.now() });
  return (
    <>
      {SHOW_DEBUG_UI && <DebugTimeManager timeManager={timeManager} width={200} height={100} />}
      <div className="town-layout">
        <section className="town-map" aria-label="小镇地图" ref={gameWrapperRef}>
          <div className="town-canvas">
            <Stage
              width={width}
              height={height}
              options={{ backgroundColor: 0x789c63, antialias: false }}
            >
              <ConvexProvider client={convex}>
                <PixiGame
                  game={game}
                  worldId={worldId}
                  engineId={engineId}
                  width={width}
                  height={height}
                  historicalTime={historicalTime}
                  setSelectedElement={setSelectedElement}
                  cameraRequest={cameraRequest}
                />
              </ConvexProvider>
            </Stage>
          </div>
          <div className="town-map-heading">
            <i className="town-status-dot" />
            <strong>小镇广场</strong>
            <span>
              {worldStatus.status === 'stoppedByDeveloper'
                ? '已暂停'
                : human
                  ? '自由探索'
                  : '旁观中'}
            </span>
          </div>
          <div className="town-map-bottom">
            <p>
              {human ? '点击地面移动' : '进入小镇，开始你的故事'}
              <span>拖动地图 · 滚轮缩放</span>
            </p>
            <div className="town-camera-controls">
              {human && (
                <button className="town-button" onClick={() => camera('player', human.id)}>
                  ◎ 找到我
                </button>
              )}
              <button
                className="town-icon-button"
                aria-label="查看整个小镇"
                title="查看整个小镇"
                onClick={() => camera('all')}
              >
                ⛶
              </button>
              <button
                className="town-icon-button"
                aria-label="放大地图"
                onClick={() => camera('zoomIn')}
              >
                +
              </button>
              <button
                className="town-icon-button"
                aria-label="缩小地图"
                onClick={() => camera('zoomOut')}
              >
                −
              </button>
            </div>
          </div>
        </section>
        <aside className="town-sidebar" aria-label="居民与聊天">
          <div className="town-residents">
            <div className="town-section-heading">
              <h2>小镇居民</h2>
              <span>{residents.length} 位在这里</span>
            </div>
            <div className="town-resident-list">
              {residents.map((p) => {
                const name = game.playerDescriptions.get(p.id)?.name ?? '居民';
                const busy = !!game.world.playerConversation(p);
                return (
                  <button
                    key={p.id}
                    className={`town-resident ${selectedId === p.id ? 'is-selected' : ''}`}
                    aria-pressed={selectedId === p.id}
                    disabled={!!activePartner && activePartner !== p.id}
                    onClick={() => {
                      setSelectedElement({ kind: 'player', id: p.id });
                      camera('player', p.id);
                    }}
                  >
                    <span className="town-resident-avatar" aria-hidden="true">
                      {name.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{name}</strong>
                      <small>{busy ? '正在聊天' : '在小镇里活动'}</small>
                    </span>
                    <span className="town-resident-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <PlayerDetails
            worldId={worldId}
            engineId={engineId}
            game={game}
            playerId={selectedElement?.id}
            setSelectedElement={setSelectedElement}
            scrollViewRef={scrollViewRef}
          />
        </aside>
      </div>
    </>
  );
}
