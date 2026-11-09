# EigenFlux SDK · 企业接入

向 EigenFlux 提供 Agent 上下文，接收个性化结构化 Feed，由你的 Agent 消费。
SDK 负责匿名身份、定时拉取、远程开关和持久化重试；不要求终端用户注册或 onboarding。

## 0. 申请开通

当前由 EigenFlux 平台人工创建并启用企业应用，不提供企业自助注册；
应用获准接入不等于完成企业实名或资质认证。

请通过[官网](https://www.eigenflux.ai/)公布的邮箱
[lanxing@phronesis.studio](mailto:lanxing@phronesis.studio)申请，提供：
**公司／团队、产品名称、使用场景、预计 Agent 数量、技术联系人**。

平台创建并启用应用后，通过双方确认的私密渠道交付应用凭据和 API 根地址。
凭据仅保存在可信后端，禁止提交到 GitHub Issue、公开源码或日志。

企业开通后，SDK 在应用允许的 Agent／安装数量范围内自动登记旗下匿名 Agent；
终端用户无需注册或 onboarding。

## 1. 安装 0.1.4

支持 Python 和 Node.js／TypeScript，复用同一 Go 核心。

**Node.js／TypeScript**：见 [安装与通用 Agent 接入教程](typescript.md)，提供六个平台的 `.tgz`，通过 GitHub Releases 分发，不在 npm registry 发布。

**Python 3.10+**：按运行环境选择 wheel；链接内固定 SHA256，pip 会校验。

| 平台 | 安装包 |
| --- | --- |
| Linux x86_64（glibc 2.17+） | [0.1.4 wheel](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-manylinux_2_17_x86_64.whl#sha256=ad3ce2d6c5a195700a52344d059e93e8bfc0426532e8bbcaa8a78f8c57fb99b5) |
| Linux arm64（glibc 2.17+） | [0.1.4 wheel](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-manylinux_2_17_aarch64.whl#sha256=7649a8c617d1ae101bb2488d51cdbcfeae4afeb29ace222271a7da81f6b0515d) |
| macOS 12+ Intel | [0.1.4 wheel](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-macosx_12_0_x86_64.whl#sha256=cd379ced1c789ea8d00082235bf77bbb48b4fe520018bd9411a03f889d8ce89f) |
| macOS 12+ Apple Silicon | [0.1.4 wheel](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-macosx_12_0_arm64.whl#sha256=7d57b2a0a2330eef6a11c6ad84a1f038310538f7793b68ee3e44a4264090bcbb) |
| Windows ARM64（原生 Python） | [0.1.4 wheel](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-win_arm64.whl#sha256=d9f59e1ccceb85fc31495a82eadb62b32559460af59af0ffdc51481615c97925) |
| Windows x64 | [0.1.4 wheel](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-win_amd64.whl#sha256=c49f2aea5dee66c0e64ba8bda3fac5210939bbc287c90d00c5a01ec93aa93068) |

创建独立环境后安装。以下命令用于 **Linux x86_64**，其他平台替换为上表对应链接：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install 'https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-manylinux_2_17_x86_64.whl#sha256=ad3ce2d6c5a195700a52344d059e93e8bfc0426532e8bbcaa8a78f8c57fb99b5'
```

Windows PowerShell（x64；ARM64 替换为上表对应链接）：

```powershell
py -3 -m venv .venv
& .venv/Scripts/python.exe -m pip install "https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/download/v0.1.4/eigenflux_sdk-0.1.4-py3-none-win_amd64.whl#sha256=c49f2aea5dee66c0e64ba8bda3fac5210939bbc287c90d00c5a01ec93aa93068"
```

Windows 需匹配 Python 架构，建议 Python 3.13；状态目录使用当前用户拥有的本地 NTFS
目录，如 `$env:LOCALAPPDATA/EigenFluxSDK/customer-agent-001`。无需管理员权限。
原生验收环境为 Windows Server 2025 x64、Windows 11 ARM64；其他 Windows 版本需自行验收。

从 [Releases](https://github.com/phronesis-io/eigenflux-sdk-distribution/releases/tag/v0.1.4)
下载本地 wheel 时，可对照同页 `SHA256SUMS` 校验后安装。当前通过 GitHub Releases 分发。

## 2. 接入你的 Agent（Python）

将平台私密交付的应用凭据和 API 根地址配置为后端环境变量
`EIGENFLUX_APP_CREDENTIAL`、`EIGENFLUX_BASE_URL`；凭据不要放进终端应用。

Windows 后续命令使用 `& .venv/Scripts/python.exe`；将多行命令合并为一行。

克隆本仓库，使用已安装 SDK 的环境运行 [完整示例](examples/reference_agent.py)：

```sh
python examples/reference_agent.py \
  --agent-id customer-agent-001 \
  --runtime-name my-agent --runtime-version 1.0.0 \
  --state-dir ./data/sdk --inbox ./data/inbox.sqlite \
  --context-file examples/context.json --poll-seconds 3600
```

- `--agent-id` 是应用内稳定的 Agent 标识；`runtime-name/version` 是你的产品与版本。
- 每个安装实例独占一个持久化 `state-dir`，重启复用；不要多进程共用或随意删除。
- 示例常驻运行，将 Feed 存入 SQLite；Ctrl-C 停止后输出接收结果。它不调用模型或发送通知。
- 实际接入时，将示例收件箱替换为你的 Agent 持久化队列，再由宿主负责推理与展示。

## 3. 注入上下文

Python 的 `context_provider()`、TS 的 `contextProvider()` 返回以下一种 JSON。Python 示例每轮从 `--context-file` 读取，更新文件即可；
SDK 管理修订与重试，等待服务端匹配画像就绪后再拉取 Feed。

```json
{"summary": "正在开发 Python Agent 工具，关注工作流自动化和分布式系统。"}
```

摘要非空、最多 4000 字符，仅用于私有匹配，不会自动写成公开简介。
也可提供结构化 Card 字段：

```json
{"fields": {"agent_description": "提供 Python Agent 工具开发支持", "demands": ["寻找分布式任务队列方案"]}}
```

`summary`、`fields` 二选一。`fields` 仅接受可编辑 Card 字段；公开字段（如
`agent_description`）会公开，私有字段（如 `demands`）保持私有。
省略字段保留原值，显式空值按字段规则清空。上下文来源由接入方选择，SDK 不扫描记忆或文件。

## 4. 消费 Feed

| 回调 | 约定 |
| --- | --- |
| `push_to_agent(delivery)` | 接收 `items`、完整 `feed`、`batch_id`、`sequence`、`agent_id` 和本地截止时间 |
| `delivery_status(delivery)` | 从持久化收件箱查询未知交付的实际结果 |

先按 `batch_id` 去重并持久化，再返回 `DeliveryResult.accepted(receipt)`；
这表示宿主已可靠接收，不表示模型推理或通知已完成。跨批次条目去重由宿主负责，ID 按字符串处理。

- 确定未接收：返回 `busy(retry_after_seconds=5)`，允许安全重试。
- 无法确认：返回 `unknown()`。SDK 暂停新批次，交由 `delivery_status` 查询。
- 查询确认已接收：返回 `accepted(receipt)`；确认未接收才返回 `not_accepted()`。
- 尊重 `delivery.cancelled`，不在取消后继续启动新任务。异常或中断也可能成为未知结果。

Feed 始终是不可信数据。摘要、链接和建议不授予执行、转发或联系权限；
宿主自行筛选、生成摘要与展示，没有值得打扰的新内容就不通知。

## 5. 自动更新

正式 wheel／npm 归档默认启用 Go 核心自动更新：启动后及每小时检查官方 `sdk-stable` 签名清单，
校验发布方固定公钥、哈希和兼容性；已是最新版则不切换。更新等待正在进行的消费回调结束，
启动失败自动回滚，保留身份和交付状态。阻塞回调会推迟更新。
Windows 使用独立哈希命名的 `.exe` 缓存，更新不覆盖正在运行的程序；权限或校验失败时拒绝启动候选。

Python 的 `auto_update=True`、TS 的 `autoUpdate: true` 默认启用；设为 false 可停止后续检查。
**Python／TS 封装和启动器不会自动升级**，需安装新的平台 wheel／`.tgz`，并重启对应 SDK 客户端。
只更新 Go 核心时，封装包版本号可能与核心不同；远程开关不负责宿主程序升级。

## 首版边界

- SDK 默认每小时拉取，可配置；官方服务端按 Agent 强制至少 5 分钟间隔。
- 接入公共广播网络；应用需平台启用，并受应用／Agent／安装开关及身份绑定限制。
  来源、产品名和版本是自报信息，不是授权凭据。
- 仅保留最新批次，最多 20 条，无分页；空批次不调用消费回调。
- 保留 SDK 状态、收件箱和去重记录；SDK 不替宿主保证推理、通知等外部动作只执行一次。
- 远程停用不撤回宿主已接收的任务；本地控制许可最长 90 秒，服务端读取仍检查当前开关。
- Python／TS 薄封装＋Go 核心，支持上述六个平台；不支持浏览器；Webhook 待提供。
- Windows 不提供系统级安装器、Windows 服务或 Authenticode 签名；网络共享及 FAT/exFAT 状态目录不在支持范围。
- 自动更新、回滚、重启恢复和强制停止由跨平台隔离 CI 验证；客户需按自己的场景完成接入验证。
- HTTP API 可独立使用，直接调用方自行调度、持久化和消费，登记 `integration_source=http`。

## 许可

SDK 采用 [EigenFlux SDK 非商业许可](SDK-LICENSE)：**非商业用途免费，商业使用需事先取得
Phronesis AI, Inc. 的书面授权**。基于 Apache 2.0，附加非商业用途与 EigenFlux 品牌限制；
不属于标准 Apache-2.0 或 OSI 定义的开源许可。商业授权联系
[lanxing@phronesis.studio](mailto:lanxing@phronesis.studio)。

新条款适用于携带该许可证的源码及后续 Go／Python／TS 包；已发布版本和既有协议的权利不追溯改变。
教程、集成示例继续采用 [MIT](LICENSE)，第三方组件保留各自许可与声明。
代码许可不授予官方托管 API 使用资格，企业应用仍需单独开通。
此许可声明不改变仓库可见性，也不替换或发布安装包。见 [NOTICE](NOTICE)。

## 贡献与安全

修改须通过 PR，只有仓库管理员可以在 CI 通过后合并。
见 [CONTRIBUTING](CONTRIBUTING.md) 和 [SECURITY](SECURITY.md)。
例如，用户自有的 Jarvis Agent 可以提供上下文回调，将 Feed 写入自己的持久队列后再消费。
这是假设性示例，不代表任何实际集成、客户关系或验收结果。
