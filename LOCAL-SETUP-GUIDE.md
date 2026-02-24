# OpenClaw 本地部署指南

## 环境要求

- Node.js >= 22
- pnpm（推荐）
- macOS / Linux / WSL2

## 一、安装与构建

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw

# 1. 安装依赖
pnpm install

# 2. 构建 Web UI
pnpm ui:build

# 3. 构建项目
pnpm build
```

## 二、配置环境变量

复制 `.env.example` 为 `.env`，填写必要配置：

```bash
cp .env.example .env
```

`.env` 中至少需要配置：

```env
# Gateway 认证令牌（可用 openssl rand -hex 32 生成）
OPENCLAW_GATEWAY_TOKEN=你的token

# 模型 API Key（至少配一个，根据你使用的模型选择）
DEEPSEEK_API_KEY=你的key
# 或 ANTHROPIC_API_KEY=你的key
# 或 OPENAI_API_KEY=你的key
# 如果使用 Gemini OAuth 登录则不需要 Key
```

## 三、运行新手引导向导

```bash
pnpm openclaw onboard --install-daemon
```

向导选项建议：

| 步骤             | 建议选择                                        |
| ---------------- | ----------------------------------------------- |
| Onboarding mode  | QuickStart                                      |
| Config handling  | Use existing values                             |
| Channel          | 根据需求选择（Telegram 最简单，无需管理员权限） |
| Skills           | No（后续按需配置）                              |
| Hooks            | Skip for now                                    |
| Configure skills | No                                              |
| Hatch bot        | Hatch in TUI（验证是否正常工作）                |

## 四、配置模型

### 方案 A：DeepSeek（推荐，简单便宜）

项目默认不内置 DeepSeek provider，需手动添加。

**1. 获取 API Key**

在 [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) 创建。

**2. 在 `.env` 中添加 Key**

```env
DEEPSEEK_API_KEY=sk-你的key
```

**3. 在 `~/.openclaw/openclaw.json` 中添加 provider 和模型配置**

在 JSON 顶层添加 `models` 块：

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com/v1",
        "apiKey": "${DEEPSEEK_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "deepseek-chat", "name": "DeepSeek V3", "contextWindow": 65536 },
          {
            "id": "deepseek-reasoner",
            "name": "DeepSeek R1",
            "contextWindow": 65536,
            "reasoning": true
          }
        ]
      }
    }
  }
}
```

修改 `agents.defaults.model` 为 DeepSeek：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "deepseek/deepseek-chat"
      },
      "models": {
        "deepseek/deepseek-chat": {},
        "deepseek/deepseek-reasoner": {}
      }
    }
  }
}
```

### 方案 B：Gemini 3 Pro（通过 Google 订阅，无需 API Key）

支持使用 Google 订阅账号通过 OAuth 登录。

**1. 启用 Gemini CLI Auth 插件**

```bash
pnpm openclaw plugins enable google-gemini-cli-auth
```

**2. 登录 Google 账号**

```bash
pnpm openclaw models auth login --provider google-gemini-cli --set-default
```

浏览器会自动打开 Google 授权页面，登录后自动回调完成认证。登录成功后默认模型会自动设为 `google-gemini-cli/gemini-3-pro-preview`。

**3. 注意事项**

- 如果请求失败，可能需要设置环境变量 `GOOGLE_CLOUD_PROJECT` 或 `GOOGLE_CLOUD_PROJECT_ID`
- Gemini CLI OAuth token 存储在 Gateway 主机的 auth profiles 中，不需要在 `openclaw.json` 里配置 client id 或 secret

### 方案 C：Anthropic Claude（需要 API Key 或 Max Plan 代理）

**直接用 API Key（推荐）：**

```env
ANTHROPIC_API_KEY=sk-ant-api03-你的key
```

项目内置 Anthropic provider，配置 Key 后直接可用。

**通过 Max Plan 订阅（需要 claude-max-api-proxy）：**

Claude Max Plan 的 OAuth token 不允许第三方应用直接调 API（会返回 403）。需要通过社区工具 `claude-max-api-proxy` 转接，但该工具目前有 bug，不推荐。

### 切换默认模型

编辑 `~/.openclaw/openclaw.json` 中的 `agents.defaults.model.primary`，例如：

```json
{ "primary": "deepseek/deepseek-chat" }
{ "primary": "google-gemini-cli/gemini-3-pro-preview" }
{ "primary": "anthropic/claude-sonnet-4-6" }
```

**重要**：切换模型后必须清除 session 缓存并重启 Gateway：

```bash
rm ~/.openclaw/agents/main/sessions/sessions.json 2>/dev/null
kill $(lsof -ti:18789) 2>/dev/null
pnpm openclaw gateway --port 18789 --verbose
```

## 五、配置 Telegram 渠道

### 1. 创建 Telegram Bot

1. 在 Telegram 中搜索 **@BotFather**
2. 发送 `/newbot`
3. 输入机器人显示名称（随便起，如 `My AI`）
4. 输入机器人用户名（必须以 `bot` 结尾，如 `myai_bot`）
5. 获取 Bot Token（格式：`123456789:ABCxxx...`）

### 2. 群聊设置（可选）

如果需要机器人在群里回复所有消息（不仅限 @提及）：

1. 对 BotFather 发送 `/mybots`
2. 选择你的机器人 → **Bot Settings** → **Group Privacy** → **Disable**
3. 将机器人拉进群聊

### 3. 配对批准

首次在 Telegram 中给机器人发消息时，机器人会返回配对码，需要在终端中批准：

```bash
pnpm openclaw pairing approve telegram <配对码>
```

## 六、配置 GitHub 集成

### 1. 安装 GitHub CLI

```bash
# macOS
brew install gh

# Linux
sudo apt install gh
```

### 2. 登录 GitHub

```bash
gh auth login
```

选择 `GitHub.com` → `HTTPS` → `Login with a web browser`，按提示在浏览器中授权。

### 3. 在 `~/.openclaw/openclaw.json` 中启用 GitHub Skill

在 `skills` 块中添加：

```json
{
  "skills": {
    "entries": {
      "github": { "enabled": true }
    }
  }
}
```

### 4. 重启 Gateway

```bash
kill $(lsof -ti:18789) 2>/dev/null
pnpm openclaw gateway --port 18789 --verbose
```

### 5. 使用示例

在 Telegram 或 TUI 中发消息即可：

- "帮我看看 openclaw/openclaw 的最新 PR"
- "查一下 openclaw/openclaw#123 这个 issue"
- "openclaw/openclaw 最近的 CI 状态怎么样"

## 七、其他渠道说明

| 渠道          | 认证方式                 | 是否需要管理员     | 难度   |
| ------------- | ------------------------ | ------------------ | ------ |
| Telegram      | BotFather 创建 Bot Token | 不需要             | 简单   |
| WhatsApp      | QR 扫码登录              | 不需要             | 简单   |
| Discord       | 创建 Bot Token           | 不需要             | 中等   |
| 飞书          | App ID + App Secret      | 需要企业管理员     | 较难   |
| Slack         | Bot Token + App Token    | 需要管理员批准安装 | 较难   |
| Web Dashboard | 无需配置                 | 不需要             | 最简单 |

## 八、启动与使用

### 启动 Gateway

```bash
pnpm openclaw gateway --port 18789 --verbose
```

### 使用方式

- **Web 控制面板**：浏览器打开 `http://127.0.0.1:18789/`
- **终端 TUI**：另开终端运行 `pnpm openclaw tui`
- **Telegram**：直接在 Telegram 中找你的机器人发消息

### 停止 / 重启 Gateway

```bash
# 停止
pnpm openclaw gateway stop

# 如果 stop 无效，直接杀进程
kill $(lsof -ti:18789) 2>/dev/null

# 启动
pnpm openclaw gateway --port 18789 --verbose
```

## 九、常用命令

```bash
# 检查状态
pnpm openclaw status
pnpm openclaw health

# 配置（按模块）
pnpm openclaw configure --section auth      # 认证
pnpm openclaw configure --section channels   # 渠道
pnpm openclaw configure --section skills     # 技能
pnpm openclaw configure --section web        # 联网搜索

# 配对管理
pnpm openclaw pairing list telegram
pnpm openclaw pairing approve telegram <code>

# 插件管理
pnpm openclaw plugins enable <plugin-name>
pnpm openclaw plugins list

# 定时任务
pnpm openclaw cron add --name "任务名" --cron "0 7 * * *" --message "要执行的指令"
```

---

## 踩坑记录

### 1. 飞书插件安装失败

**现象**：onboard 时选择 Feishu 渠道，npm 安装插件依赖失败。

**解决**：选择 "Use local plugin path instead?"→ Yes，使用项目源码中 `extensions/feishu` 的本地插件。

### 2. 飞书/Slack 需要企业管理员权限

**现象**：飞书需要 App ID + App Secret，只能在飞书开放平台创建自建应用获取；Slack 需要管理员批准才能安装 App。

**解决**：如果你不是企业管理员，需要联系管理员配合。建议先用 Telegram（自己可以直接创建 Bot，无需管理员）或 Web Dashboard。

### 3. HTTP 403 forbidden: Request not allowed（Anthropic）

**现象**：TUI 中发消息报 `HTTP 403 forbidden: Request not allowed`，模型调用被拒绝。

**原因**：Claude Max Plan 的 OAuth setup-token 不允许第三方应用直接调用 Anthropic API。错误来自 Anthropic 服务端，不是本地配置问题。

**解决**：换用其他模型（DeepSeek / Gemini），或使用独立的 Anthropic API Key（按量付费）。

### 4. 切换模型后仍显示旧模型

**现象**：在 `openclaw.json` 中修改模型后，TUI 仍显示旧模型。

**原因**：Session 缓存文件 `~/.openclaw/agents/main/sessions/sessions.json` 中绑定了旧的模型和认证配置。

**解决**：

```bash
rm ~/.openclaw/agents/main/sessions/sessions.json
kill $(lsof -ti:18789) 2>/dev/null
pnpm openclaw gateway --port 18789 --verbose
```

### 5. Gateway 启动报端口占用

**现象**：`Gateway failed to start: gateway already running (pid xxx); lock timeout`

**解决**：

```bash
pnpm openclaw gateway stop
# 如果 stop 无效（守护进程接管），直接杀进程
kill <pid>
# 或
kill $(lsof -ti:18789)
# 然后重新启动
pnpm openclaw gateway --port 18789 --verbose
```

### 6. Gateway Token 不匹配

**现象**：`gateway closed (1008): unauthorized: device token mismatch`

**原因**：`.env` 中的 `OPENCLAW_GATEWAY_TOKEN` 与 `~/.openclaw/openclaw.json` 中 `gateway.auth.token` 的值不一致。

**解决**：确保两处 Token 一致。以 `openclaw.json` 中的值为准，同步到 `.env`。

### 7. Telegram Bot 连接 404

**现象**：Gateway 日志中 Telegram 反复报 `Call to 'getMe' failed! (404: Not Found)`。

**原因**：Bot Token 无效或粘贴错误。

**解决**：去 Telegram @BotFather 发 `/mybots`，确认 Token 正确，然后通过 `pnpm openclaw configure --section channels` 更新。

### 8. Telegram 首次发消息无回复

**现象**：在 Telegram 中给机器人发消息，只收到配对码，没有 AI 回复。

**原因**：OpenClaw 默认开启 DM 配对安全策略（`dmPolicy: "pairing"`），需要先批准。

**解决**：

```bash
pnpm openclaw pairing approve telegram <配对码>
```

### 9. 飞书插件重复警告

**现象**：启动时提示 `plugin feishu: duplicate plugin id detected`。

**原因**：onboard 时既从 npm 下载了插件（失败后回退），又使用了本地路径，导致注册了两次。

**解决**：可忽略，不影响使用。如需消除警告，编辑 `~/.openclaw/openclaw.json`，删除 `plugins.entries` 中多余的 feishu 条目。

### 10. claude-max-api-proxy 崩溃

**现象**：代理启动后子进程报 `TypeError: Cannot read properties of undefined (reading 'includes')` 或消息返回 `[object Object]`。

**原因**：这是社区工具的 bug，与 OpenClaw 消息格式不兼容。

**解决**：暂不推荐使用此代理。建议直接使用 Anthropic API Key 或换用其他模型。

### 11. Unknown model 错误

**现象**：`Error: Unknown model: google-gemini-cli/gemini-3.1-pro`

**原因**：该模型 ID 尚未被当前版本的项目内置模型目录收录。

**解决**：使用已支持的模型 ID，如 `google-gemini-cli/gemini-3-pro-preview`。可通过查看 `node_modules/@mariozechner/pi-ai/dist/models.generated.js` 确认支持哪些模型。
