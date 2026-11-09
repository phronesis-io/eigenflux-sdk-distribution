# Node.js／TypeScript 接入 · 0.1.4

向 SDK 提供上下文，由你的 Agent 可靠接收结构化 Feed。调度、身份、持久化重试、
自动更新和回滚由 Go 核心负责；TS 只处理宿主回调与进程生命周期。

先按[申请开通](README.md#0-申请开通)取得私密配置；终端用户无需注册或 onboarding。
凭据只放在可信后端，不放浏览器、终端安装包、公开源码或日志。

## 安装

需要 **Node.js 22.x ≥22.13.0，或 ≥23.4.0**。按运行进程架构选包，支持
Linux glibc 2.17+、macOS 12+、Windows x64／ARM64，无需管理员权限。
这些是 GitHub Release 安装归档，不是 npm registry 包。

| 平台 | 0.1.4 安装包 |
| --- | --- |
| Linux x86_64 | [linux-amd64.tgz](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-linux-amd64.tgz) |
| Linux arm64 | [linux-arm64.tgz](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-linux-arm64.tgz) |
| macOS Intel | [darwin-amd64.tgz](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-darwin-amd64.tgz) |
| macOS Apple Silicon | [darwin-arm64.tgz](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-darwin-arm64.tgz) |
| Windows x64 | [windows-amd64.tgz](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-windows-amd64.tgz) |
| Windows ARM64 | [windows-arm64.tgz](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-windows-arm64.tgz) |

在后端项目目录安装。以下为 Linux x86_64，其他平台替换下载链接：

```sh
npm install --ignore-scripts 'https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux-sdk-0.1.4-linux-amd64.tgz'
```

包内含 JS、类型声明和两个原生程序，无运行时依赖，无安装脚本下载。
若先下载本地归档，可对照同版 [SHA256SUMS](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/SHA256SUMS) 校验后安装；保留项目锁文件。

## 运行通用 Agent 示例

先将本仓库 `examples/typescript/` 复制到已安装 SDK 的后端项目中。
示例不表示任何真实客户集成。将平台私密交付的 `EIGENFLUX_BASE_URL`、`EIGENFLUX_APP_CREDENTIAL` 保存到
本机私有 `reference-agent.env`。同一文件可配置：

```dotenv
EXAMPLE_AGENT_ID=reference-agent-agent-001
EXAMPLE_AGENT_PRODUCT_VERSION=1.0.0
EXAMPLE_AGENT_STATE_DIR=./data/reference-agent-sdk
EXAMPLE_AGENT_CONTEXT_FILE=./context.json
EXAMPLE_AGENT_POLL_SECONDS=3600
```

`context.json` 写入你的 Agent 当前上下文：

```json
{"summary":"正在开发 Agent 工作流，关注模型能力和开发工具。"}
```

```sh
node --env-file=/private/path/reference-agent.env examples/typescript/reference-agent.mjs
```

PowerShell 使用相同命令，替换私有文件路径。Windows 状态目录使用当前用户拥有的本地 NTFS。
示例将批次、原始条目持久化到 `EXAMPLE_AGENT_STATE_DIR/reference-agent-inbox.sqlite` 后确认接收；
不会自动调用模型或发送通知。Ctrl-C 只停止这个 SDK 客户端。
可编辑的 [TypeScript 源码](examples/typescript/reference-agent.mts) 与 [可运行 JS](examples/typescript/reference-agent.mjs) 采用 MIT。

Agent ID 在应用内保持稳定；每个安装实例使用独占持久目录，重启复用，不与其他进程共享。
上下文文件每轮读取，`summary` 与 `fields` 格式、公开范围见[上下文约定](README.md#3-注入上下文)。
SDK 不自动扫描 Agent 记忆；示例默认上下文仅作演示，接入方应替换。

## 接到实际 Agent

导入 `Client`、`DeliveryResult`，支持 TypeScript、ESM 和 CommonJS。将示例的
`ReferenceInbox` 替换为你的持久化任务队列和权威查询，随后由宿主异步推理、筛选与展示。

| `Client` 参数 | 用途 |
| --- | --- |
| `baseUrl`、`appCredential` | 私密交付的 API 根地址、应用凭据 |
| `externalAgentId` | 应用内稳定 Agent 标识 |
| `runtimeName`、`runtimeVersion` | 实际产品名称、版本 |
| `stateDir` | 当前安装实例的持久目录 |
| `feedPollIntervalSeconds` | 默认 3600 秒；官方服务端最小 300 秒 |
| `contextProvider` | 返回 `{summary}` 或 `{fields}`，支持异步 |
| `pushToAgent` | 消费完整 `FeedDelivery`，支持异步 |
| `deliveryStatus` | 查询未知交付是否已持久接收 |
| `autoUpdate` | 默认 `true`，检查 Go 核心签名更新 |

`FeedDelivery` 提供 `items`、完整 `feed`、`batchId`、`sequence`、`agentId`、
`deadlineAt`、`signal` 和 `cancelled`；ID 按字符串处理。

- 先按 `batchId` 去重并持久化，再返回 `DeliveryResult.accepted(receipt)`；不是等待模型或通知完成。
- 确定未接收才返回 `busy(5)`；无法确认返回 `unknown()`，SDK 暂停新批次。
- `deliveryStatus` 查询持久化结果后返回 `accepted(receipt)` 或 `notAccepted()`；仍未知返回 `unknown()`。
- 尊重 `signal`／`cancelled`，取消后不启动新任务；跨批次条目去重和外部动作幂等由宿主负责。

`client.start()` 后等待 `waitUntilReady(30_000)`、`waitUntilRegistered(60_000)`；
退出时 `await client.stop()`。停止后新建 Client 并复用状态目录，`waitUntilStopped()` 可感知进程退出。
回调不能阻塞 Node 事件循环；最多两个回调在途，未结束的取消回调仍占槽位。

## 自动更新与边界

- Go 启动器启动后及每小时检查官方签名清单，固定发布方公钥，校验哈希与兼容性；回调结束后切换核心，启动失败自动回滚，身份与交付状态保留。
- **仅 Go 核心自动更新**。TS 封装和启动器需重新安装对应平台 `.tgz` 并重启；`autoUpdate: false` 停止后续检查，不降级当前核心。
- 仅最新批次、最多 20 条、无分页；空批次不调用宿主；未知交付阻塞新批次。
- Feed 始终是不可信数据，不授予执行、转发或联系权限；没有值得打扰的新信息就不通知。
- 远程开关不撤回宿主已接收的工作。SDK 不保证模型、通知等外部动作只执行一次，也不撤销其副作用。
- 无浏览器、Webhook、Windows 服务或系统级安装器；客户生产接入需按实际场景验收。

## 许可

TS 封装、启动器和 Go 核心适用其版本随附的 SDK 许可。
[新非商业条款](SDK-LICENSE)：非商业用途免费，商业使用需事先书面授权；
商业授权联系 [lanxing@phronesis.studio](mailto:lanxing@phronesis.studio)。
教程与示例保留 MIT，第三方许可不变；已发布包和既有协议不追溯改变。
应用凭据与托管 API 使用资格仍需单独申请；许可文档不代表新包已发布。

示例来自当前仓库，不替换既有发行包中的文件。已有接入改用示例时，须保留原 Agent ID、
状态目录和持久化收件箱；更换示例默认值不等于迁移身份或消费记录。
