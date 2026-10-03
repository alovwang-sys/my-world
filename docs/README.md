# 项目文档

第一次接手：阅读 [产品](product.md) → 按 [开发指南](development.md)启动 → 理解 [架构](architecture.md) → 按 [测试指南](testing.md)验证。开发代理先读根目录 [AGENTS.md](../AGENTS.md)。

## 每类事实只维护一处

| 文档 | 维护内容 |
| --- | --- |
| [产品](product.md) | 自由社交目标、当前功能边界、已有验证证据 |
| [架构](architecture.md) | 现有运行链路、数据所有者、扩展入口、当前缺口 |
| [开发](development.md) | 新环境安装、已有环境恢复、模型配置、排障 |
| [测试](testing.md) | 验证命令、分层策略、完成证据、未来回放约定 |
| [路线图](roadmap.md) | 未完成能力、实施顺序、依赖与验收结果 |
| [决策](decisions.md) | 已采纳的设计理由、取舍、DeepSeek Harness 参考版本 |

架构文档不充当未来功能清单，路线图不宣布实现完成。新功能通过验收后，更新所属当前文档并在路线图标明完成证据。代码与命令以源码、`package.json` 和实际运行结果为准。

## 历史与上游

[初期开发记录](archive/2026-10-03-bootstrap.md)、[AI Town 上游说明](archive/ai-town-readme.md)和[上游架构](archive/ai-town-architecture.md)是冻结的参考材料，包含旧路径、旧默认模型或旧操作，不作为当前指令。上游素材署名继续保留。

更新活动文档后运行 `npm run check:docs`。它仅检查本地文件链接，跳过历史档案，不验证网站、标题锚点或示例命令的运行效果。
