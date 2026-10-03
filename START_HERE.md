# 英语学习小镇 开始指南

当前目标：复用 AI Town 的地图、移动、NPC 会话和持久化，构建用户可以用英语自由参与的社交小镇。用户自行选择对象、话题和行动；NPC 之间也会交流，并留下可以追问的经历。咖啡馆是镇上的一个地点。

## 产品方向：自由参与与社交记忆

2026-10-02 的设计调整：以自由探索为主，让 NPC 有各自的兴趣、去处和简单目标。用户可以聊天、了解其他人、提出建议、发起邀约或参与小事件，不要求每次走完固定任务路线。

第一版场景只需广场、咖啡摊、河边座位。Emma、Ben、Alex 可以在这些地点活动、碰面和聊天。地点先为社交提供背景，订单、库存等业务系统后续按实际需要加入。

下一段最小闭环：两位 NPC 实际聊天 → 会话记录保存 → 用户向其中一位追问 → 该 NPC 根据自己参与的真实记录回答。例：`What did you and Ben talk about?`。回答应区分对方说的话、自己的看法，以及尚未落实的计划；没有记录时明确说不记得，不编造过去的对话。经别人转述的事情要保留来源。

已有 `messages`、`archivedConversations`、`participatedTogether` 表保存原句、参与人和时间。近期记忆可以先按世界、本人、谈话对象与时间查询实际记录，不必依赖嵌入服务。每轮只提供少量本人参与的历史会话；规模扩大后再评估摘要与语义检索。

上述社交记忆是下一阶段设计，当前代码仍只有 Emma，尚未实现跨会话回忆，也未实测 NPC 互聊后的追问。

### Jev 参与自主决策（设计，尚未接入）

每个 NPC 保存自身兴趣、当前目标、进行中的动作和有来源的记忆。程序维护世界实际支持的动作库，并基于本人可感知的状态、路径、占用情况和动作条件，构造当前可执行的候选动作。

Jev 接收当前目标、必要状态、相关记忆和少量候选动作，判断下一步。首版用一个 Choice 选择完整的候选动作 ID，例如 `go_to_ben_at_cafe` 或 `invite_ben_to_chat`，让动作与目标对象绑定，避免分别判断动作和对象产生不一致。候选动作保留等待、继续当前活动或请求澄清等路径。

控制器在执行前重新检查动作是否仍可用，执行寻路或邀请，并记录真实完成结果。另一位 NPC 独立判断是否接受邀请。GLM 生成台词；对话和场景结果写回记录，影响下一次判断。复杂的新目标可以在发生重要事件时由 GLM 提议，再由控制器约束为可支持的目标。

决策发生在动作完成、用户请求、收到邀请、相关新消息或路径失效等事件后；正常行走由程序连续执行，不按每一帧调用模型。此流程选择和组合有限动作，保留动态目标与开放对话，不要求用户遵循固定任务路线。

实际接入需要独立的 TypeSafe API Key。先验证一位 NPC 主动找另一位聊天，覆盖对方忙碌、拒绝邀请和途中被用户打断的情况，再扩大动作库。参考：[TypeSafe 介绍](https://docs.typesafe.ai/introduction)、[Jev 已知局限](https://docs.typesafe.ai/model-jaggedness/jev-1.13)。

## 当前已完成

- 项目：`/Users/amos/project/learn-english/ai-town`。
- 上游：[a16z-infra/ai-town](https://github.com/a16z-infra/ai-town)，固定提交 `8e05997f2409275669c8344b84a51692e83f3f33`，本地分支 `learn-english-bootstrap`。
- 使用上游 React、PixiJS、Convex，保留 MIT 许可和地图、人物素材署名。
- 模型固定为 `glm-5.3-flash`，聊天入口已配置为 `https://open.bigmodel.cn/api/coding/paas/v4`。
- 2026-10-02 实际请求返回 HTTP 200，返回模型名称为 `glm-5.3-flash`，有非空英文正文。
- 已创建第一位 NPC Emma，浏览器验证加入小镇、接受邀请、双方走近、问候和真实模型回答。
- 验证发言：`I'd like a coffee, please. What do you recommend?`。Emma 回答：`Great choice! I recommend our latte — it's smooth and creamy. Would you like it hot or iced?`。页面随后收到“我想知道你是谁”，Emma 回答身份并继续追问拿铁偏好，说明当前会话上下文可用。
- 当前预览：`http://127.0.0.1:5173/ai-town/`。
- 构建通过；10 组 / 64 个测试全部通过（2026-10-03，包含活动计时回归）。

## 网页交互改进（2026-10-03）

- 入口移到顶部，地图与聊天分栏；窄屏改为上下排列。
- 居民列表选人并定位，地图显示人物名字；提供找到我、全图与缩放按钮。
- 收起操作说明，隐藏内部人设提示；显示邀请、走近和回复状态。
- 原生文本框与发送按钮，保护中文输入法选字，发送失败保留草稿，发送期间禁止重复提交。
- 历史记录独立滚动，输入框固定在底部；浏览旧消息时不强制跳到底部，可点击查看最新消息。
- 关闭正在进行的对话会真正离开会话，随后可以再选人；音乐不再占用聊天中的 M 键。
- 修正所有成功用户输入的活动计时：移动、邀请、输入和发送会更新 lastInput；NPC 后台回复不会延长用户的闲置时间。新增真实游戏输入与超时退出的回归测试。

可复核操作：进入小镇 → 选择 Emma → 走到附近 → 打招呼 / 接受邀请 → 在输入框用 Shift + Enter 换行 → Enter 或按钮发送 → 点击关闭对话 → 再次选择 Emma 查看上一段记录。界面支持自由话题，不引入固定任务步骤。

## 模型配置和记忆范围

密钥仅保存在 Git 忽略的 `.env.bigmodel.local` 与本地 Convex 后端配置中；本地文件权限为 `600`，不放进前端环境变量、源码或本指南。

配置文件格式如下，实际 Key 在本地填写：

```dotenv
LLM_PROVIDER=bigmodel
BIGMODEL_API_KEY=<本地填写>
BIGMODEL_CHAT_MODEL=glm-5.3-flash
BIGMODEL_CHAT_API_URL=https://open.bigmodel.cn/api/coding/paas/v4
BIGMODEL_EMBEDDING_MODEL=embedding-3
VECTOR_MEMORY_ENABLED=false
```

聊天和嵌入入口分别配置。普通 API 的 `embedding-3` 已实测返回 HTTP 429 / `1113`（无可用余额或资源包），因此当前关闭向量记忆检索、会话总结和记忆反思，不发送嵌入请求。当前会话记录仍保存在 Convex 中，并用于连续交流；跨会话的长期语义记忆尚未启用。

`glm-5.3-flash` 必须开启思考。适配使用 `reasoning_effort: low`，至少 2048 的输出预算，避免原版 1/300 token 限制导致缺少正文。角色提示控制回答简短，思考内容不显示为台词。余额不足错误不会反复重试。

本次成功仅证明该入口能够返回回答。智谱[官方常见问题](https://docs.bigmodel.cn/cn/coding-plan/faq)对 Coding Plan 的适用工具和自建应用有明确范围规定；自建应用正式使用应按其标准 API 服务说明配置。这里保留聊天入口可配置，便于后续切换标准 API，而不用更换 AI Town 底座。

## 启动项目

本机已安装依赖，Node.js `24.21.0`、npm `11.19.0`。使用匿名本地 Convex 后端，不需要 Docker 或 Convex 账号。

第一个终端：

```sh
cd /Users/amos/project/learn-english/ai-town
CONVEX_AGENT_MODE=anonymous npm run dev:backend
```

等待函数准备完成后，第二个终端：

```sh
cd /Users/amos/project/learn-english/ai-town
npm run dev:frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

当前世界和 Emma 已经创建，启动后会恢复，不需要重建。打开预览，点击右上角 **进入小镇** 加入。点击地面移动，拖动地图平移，滚轮缩放。点击右侧居民列表选中并定位 Emma，可选择 **走到附近** 自动寻路，再 **打个招呼**；也可以接受 Emma 的邀请。双方碰面后，聊天输入框固定在右侧底部。Enter 发送、Shift + Enter 换行；也可点击发送按钮。

停止服务时关闭对应终端即可，本地数据会保留。`.env.local`、`.env.bigmodel.local`、`.convex` 均不提交到 Git。

## 修改配置及验证

只有更改本地模型配置后才需重新写入后端：

```sh
npx convex env set --force --from-file .env.bigmodel.local
```

运行一次有界的真实模型检查：

```sh
npm run check:models
```

脚本使用当前聊天入口与指定模型，不输出 Key 或思考内容，也不重试。当 `VECTOR_MEMORY_ENABLED=false` 时只检查聊天；不会把未验证的嵌入接口称为成功。应看到 `status: 200`、`usable: true`、`returnedModel: glm-5.3-flash` 和英文正文。

新建空世界时，先创建一个 NPC：

```sh
npx convex run init '{"numAgents":1}'
```

已有 NPC 时，`init` 不会重复添加。原版 `npm run dev` 默认会初始化全部角色，当前阶段推荐上面的两个终端启动方式。

## 已完成验证与下一步

| 项目 | 当前结果 |
| --- | --- |
| 地图和移动 | 加入、点击移动、平移和缩放可用 |
| NPC 对话 | Emma 邀请、双方走近、问候、回答均可用 |
| 指定模型 | `glm-5.3-flash` 的真实请求返回成功 |
| 当前会话上下文 | 连续交流可用，聊天记录持久化 |
| 长期向量记忆 | 暂时关闭，需独立解决嵌入服务额度 |
| 咖啡馆业务 | 订单、库存、座位和任务状态尚未实现 |
| 英语学习反馈 | 独立纠错、证据评分和复练尚未实现 |
| Jev 和语音 | 尚未接入 |

后续开发顺序：

1. 增加 Ben、Alex，配置不同兴趣和简单活动目标，验证 NPC 互聊；用户输入优先，控制背景交流频率。
2. 根据已有会话记录接入本人近期记忆，验证用户能追问 NPC 与另一个 NPC 聊了什么。按世界和参与者限定记录范围，不把所有人的经历都交给每个 NPC。
3. 让记忆影响后续交流与邀约，例如再次见面延续话题，或记得用户表达过的偏好。
4. 将地图整理为广场、咖啡摊、河边座位，让人物活动有可辨认的地点。
5. 加入轻量英语反馈与原句证据，用户可选择回顾和复练；开放聊天持续可用。
6. 按需要接入 Jev、语音、业务事件与长期记忆检索。场景动作由程序确认执行结果。

Emma 目前可以讨论偏好，不能据台词认定订单已创建或饮品已制作。实际任务完成必须等程序状态模块接入。

## 改造入口

- `data/characters.ts`：人物身份与目标，第一位为 Emma。
- `convex/util/llm.ts`：模型、聊天入口和嵌入适配。
- `convex/agent/conversation.ts`：台词、当前会话历史与可选记忆检索。
- `convex/agent/memory.ts`：长期记忆开关、总结和检索。
- `convex/aiTown/agent.ts`：角色活动与会话调度。
- `convex/aiTown/inputs.ts`：场景合法输入，后续扩展订单与带位事件。
- `src/components/PlayerDetails.tsx`、`MessageInput.tsx`：选人、会话和输入界面。

参考：[AI Town 架构](https://github.com/a16z-infra/ai-town/blob/main/ARCHITECTURE.md)、[GLM-5.3-Flash](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash)、[Embedding-3](https://docs.bigmodel.cn/cn/guide/models/embedding/embedding-3)、[Convex 本地部署](https://docs.convex.dev/cli/local-deployments)。
