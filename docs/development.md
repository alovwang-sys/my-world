# 开发指南

## 环境与首次启动

命令从仓库根目录执行。本机已验证 Node.js `24.21.0` 与 npm `11.19.0`；采用 Node 24 与现有 npm lockfile，不要求 Docker 或 Convex 账号。离线测试不需要 Key，实际 NPC 对话需要后端模型配置。

### 1. 安装

```sh
git clone https://github.com/alovwang-sys/my-world.git
cd my-world
npm ci
```

当前 Git 主分支为 `main`，`origin` 指向本项目，已有本机的 `upstream` 指向 AI Town。新克隆不包含第二个 remote，也不包含已有世界、Emma、环境文件或凭据。

### 2. 启动本地后端

第一个终端：

```sh
CONVEX_AGENT_MODE=anonymous npm run dev:backend
```

这是当前安装版本 Convex 的匿名本地模式，CLI 可能下载本地后端并生成 `.env.local` 与本地数据配置。等待函数部署完成，保持终端运行。若本机已有部署，沿用它，不重新配置或清库。

### 3. 配置模型

新建被 Git 忽略的 `.env.bigmodel.local`，在编辑器内填写真实 Key，不将 Key 放进命令参数或前端变量：

```dotenv
LLM_PROVIDER=bigmodel
BIGMODEL_API_KEY=<在本机填写>
BIGMODEL_CHAT_MODEL=glm-5.3-flash
BIGMODEL_CHAT_API_URL=https://open.bigmodel.cn/api/coding/paas/v4
BIGMODEL_EMBEDDING_MODEL=embedding-3
VECTOR_MEMORY_ENABLED=false
```

这是当前已验证的聊天配置。聊天网关单独可配置，嵌入使用普通 API 网关；两者的访问能力不能互相推定。当前套餐入口适用于何种正式使用，请核对供应商 [Coding Plan 说明](https://docs.bigmodel.cn/cn/coding-plan/faq)，正式应用按已授权服务配置网关。

写入当前本地后端：

```sh
chmod 600 .env.bigmodel.local
npx convex env set --force --from-file .env.bigmodel.local
```

`--force` 覆盖文件中同名变量，仅在明确要更新当前部署配置时使用。文件只供手动同步与检查脚本使用，后端不会因编辑文件自动读取它。

适配保留 `glm-5.3-flash` 的思考模式，使用低推理强度、至少 2048 输出预算，界面只显示正文。向量开关为 false 时不发嵌入请求，也不生成总结与反思。近期原句记忆不依赖这个开关；在 Emma 面板切换 recent/off，设置由后端保存。关闭回忆期间仍归档，开启后可以恢复；查看来源和体验步骤见 [产品](product.md)。启用前先验证额度、1024 维契约和已有索引兼容；详见 [llm](../convex/util/llm.ts)与 [memory](../convex/agent/memory.ts)。

### 4. 仅在空世界初始化

```sh
npx convex run init '{"numAgents":1}'
```

`init` 创建默认世界，并仅在没有 agent 且没有待处理创建输入时添加角色。已有 NPC 时此命令不会添加更多。`npm run dev` 有 `predev`，空世界默认初始化全部源人物；当前原型推荐分开启动，显式控制数量。

第一位初始定义是 Emma。修改 [characters](../data/characters.ts)只影响之后创建的角色；追加 Ben、Alex 或修改已有角色需要专门操作与迁移，不能用清库代替。地图也是初始化时持久化，不随源文件编辑自动替换。

### 5. 启动前端

第二个终端，从同一仓库根目录运行：

```sh
npm run dev:frontend -- --host 127.0.0.1 --port 5173 --strictPort
```

打开 `http://127.0.0.1:5173/ai-town/`。进入 → 选 Emma → 走到附近 → 打招呼或接受邀请 → 等双方走近 → 发言。输入与地图交互约定见 [产品文档](product.md)。

停止时结束对应终端；本地数据保留。`/ai-town/` 是 [Vite base](../vite.config.ts)，不要将根路径误认为应用入口。

## 已有环境的日常开发

保留本地 `.env.local`、`.env.bigmodel.local` 和 Convex 数据目录，直接重复后端与前端两个启动命令。只有配置变更时再写入后端；不重复初始化人物。运行相关离线验证与浏览器检查，具体命令见 [测试指南](testing.md)。

真实模型检查是手动、有费用的操作：

```sh
npm run check:models
```

脚本必须能读取 `.env.bigmodel.local`，进程环境优先于文件；没有自动重试，单次请求有 90 秒超时。当前开关 false 时只检查聊天。成功需 HTTP 200、`usable: true`、返回指定模型且正文非空，不接受只有思考内容或单独 HTTP 成功。不要将输出连同私有会话或部署信息提交。

## 排障

| 现象 | 检查 |
| --- | --- |
| 前端连不上后端 | 后端终端是否运行；`.env.local` 是否对应当前部署；改变前端环境后重启 Vite |
| 没有 NPC | 是否空世界、初始化输入是否处理；已有 agent 时 `init` 不会追加 |
| 修改名字仍显示旧人设 | 检查持久化的 descriptions，源文件不自动迁移已有数据 |
| 无台词或响应慢 | 查后端错误、配置网关、正文与超时；失败会在聊天中提示并提供「重试回复」，重试保留原消息、不再发一份。TLS 握手错误表示连接阶段失败；离线成功不能证明真实 API 可用 |
| 嵌入返回 429 / 1113 | 此前检查表示资源/额度不足；保持向量关闭，独立解决服务访问后再验证 |
| 无人看时世界暂停 | 回到页面等待 heartbeat；开发者手动停止时可运行 `npx convex run testing:resume` |
| 端口 5173 被占 | 找到所属服务，或换端口并使用对应 URL；不要杀死未知进程 |

当前不提供已验收的公开多用户部署流程。先完成 [路线图](roadmap.md)中的身份与访问控制。上游 Docker、Windows 与其他供应商说明在 [历史档案](archive/ai-town-readme.md)，需按当前依赖和配置重新验证。
