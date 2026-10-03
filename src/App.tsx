import Game from './components/Game.tsx';
import { ToastContainer } from 'react-toastify';
import MusicButton from './components/buttons/MusicButton.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';

export default function Home() {
  return (
    <main className="town-app">
      <header className="town-header">
        <div className="town-brand">
          <span className="town-brand-icon" aria-hidden="true">
            ✳
          </span>
          <div>
            <h1>
              英语小镇 <span>AI TOWN</span>
            </h1>
            <p>四处走走，找个人聊聊。</p>
          </div>
        </div>
        <div className="town-header-actions">
          <details className="town-help">
            <summary>怎么玩</summary>
            <div className="town-help-content">
              <strong>从一次打招呼开始</strong>
              <p>1. 点击「进入小镇」，黄色标记就是你。</p>
              <p>2. 点击地面走过去；拖动地图或滚轮缩放。</p>
              <p>3. 从居民列表选人，点击「打个招呼」。等双方走近，就可以自由聊天。</p>
              <p>Enter 发送，Shift + Enter 换行。离开对话后也能查看这次聊天。</p>
              <p>闲置五分钟会回到旁观模式，可以再次进入。</p>
              <MusicButton /> <FreezeButton />
            </div>
          </details>
          <InteractButton />
        </div>
      </header>
      <Game />
      <footer className="town-footer">
        <span>用你自己的话，参与这里的生活。</span>
        <span>
          基于 <a href="https://github.com/a16z-infra/ai-town">AI Town</a> ·{' '}
          <a href="https://convex.dev/c/ai-town">Convex</a>
        </span>
      </footer>
      <ToastContainer position="bottom-right" autoClose={4000} closeOnClick theme="light" />
    </main>
  );
}
