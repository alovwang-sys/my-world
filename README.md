# My World · 英语学习小镇

复用 [AI Town](https://github.com/a16z-infra/ai-town) 构建可自由参与的英语社交世界。用户选择和谁聊、聊什么、去哪里；目标是让 NPC 之间也形成真实经历，用户可以追问和参与他们的生活。

当前是 React + PixiJS + Convex 的本地原型，已验证一位居民 Emma 的移动、邀请和 GLM 对话。多人社交记忆、Jev 判断与语音仍在设计中。功能边界和证据见 [产品文档](docs/product.md)。

## 开始使用

1. 按 [开发指南](docs/development.md) 安装依赖、启动本地后端并填写模型配置。
2. 打开 `http://127.0.0.1:5173/ai-town/`，进入小镇，选 Emma、走近并打招呼。
3. 开发前阅读 [AGENTS.md](AGENTS.md) 和 [架构](docs/architecture.md)，按 [测试指南](docs/testing.md)验证改动。

完整入口：[文档索引](docs/README.md) · [开发路线图](docs/roadmap.md) · [DeepSeek Harness 借鉴与决策](docs/decisions.md)。

API Key、本地部署配置和数据均不随仓库分发。当前匿名身份原型的部署边界见 [产品文档](docs/product.md)。

## 来源与署名

代码保留 [MIT 许可证](LICENSE)，上游说明与完整署名保存在 [AI Town 原始说明](docs/archive/ai-town-readme.md)。地图和人物素材分别保留其原许可要求：

- Tilesheet：[George Bailey](https://opengameart.org/content/16x16-game-assets)、[hilau](https://opengameart.org/content/16x16-rpg-tileset)。
- 原始场景素材：[ansimuz](https://opengameart.org/content/tiny-rpg-forest)；UI 素材：[Mounir Tohami](https://mounirtohami.itch.io/pixel-art-gui-elements)。
- 渲染：[PixiJS](https://pixijs.com/)；上游原型参考：[phaser3-simple-rpg](https://github.com/pierpo/phaser3-simple-rpg)。
