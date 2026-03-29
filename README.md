# Paperclip Slack Bridge

Bidirectional bridge between [Paperclip](https://github.com/paperclip-ai/paperclip) and Slack. Forwards agent activity, approvals, and budget alerts to Slack channels — and accepts slash commands, threaded replies, and approval actions back into Paperclip.

Runs as a Docker sidecar alongside your Paperclip instance. Uses Slack Socket Mode, so **no public URL or ingress required**.

```
VPS (Docker Compose)
├── paperclip        (existing — control plane)
├── postgres         (existing — Paperclip DB)
└── slack-bridge     (this service — no exposed ports)
    ├── Paperclip API via Docker network
    └── Slack via Socket Mode (outbound WSS only)
```

## Features

**Outbound (Paperclip → Slack)**
- Issue status changes with Block Kit cards
- Agent run completions with duration and cost
- Budget threshold warnings (80%) and exhaustion alerts (100%)
- Approval requests with interactive Approve/Reject buttons
- Configurable channel routing via `channels.json`

**Inbound (Slack → Paperclip)**
- `/pc-task` — Create issues with optional agent assignment
- `/pc-status` — View agent statuses
- `/pc-costs` — Cost summary
- `/pc-pause` — Pause an agent
- `/pc-approve` — Approve a pending request
- **Thread replies** on bridge messages become issue comments
- **Approval buttons** approve/reject directly from Slack

## Quick Start

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. **Socket Mode** — Enable it under Settings → Socket Mode, generate an app-level token with `connections:write` scope
3. **Bot Token Scopes** — Add under OAuth & Permissions:
   - `chat:write`
   - `commands`
   - `channels:read`
   - `groups:read`
4. **Slash Commands** — Register these under Features → Slash Commands:
   - `/pc-task`
   - `/pc-status`
   - `/pc-costs`
   - `/pc-pause`
   - `/pc-approve`
5. **Interactivity** — Enable under Features → Interactivity & Shortcuts (no request URL needed with Socket Mode)
6. **Event Subscriptions** — Subscribe to `message.channels` and `message.groups` bot events
7. **Install** the app to your workspace and copy the Bot User OAuth Token

### 2. Get a Paperclip API Key

Generate a board-level API key from your Paperclip instance. The bridge needs board permissions to read activity, manage approvals, and create issues.

### 3. Deploy with Docker Compose

Add to your existing Paperclip `docker-compose.yml`:

```yaml
  slack-bridge:
    build: ./slack-bridge
    restart: unless-stopped
    depends_on:
      server:
        condition: service_started
    environment:
      PAPERCLIP_API_URL: http://server:3100/api
      PAPERCLIP_API_KEY: ${PAPERCLIP_BRIDGE_API_KEY}
      PAPERCLIP_COMPANY_ID: ${PAPERCLIP_COMPANY_ID}
      SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}
      SLACK_APP_TOKEN: ${SLACK_APP_TOKEN}
      POLL_INTERVAL_MS: "30000"
      CHANNEL_MAP_PATH: /config/channels.json
      SQLITE_PATH: /data/bridge.db
    volumes:
      - ./slack-bridge/config:/config:ro
      - slack-bridge-data:/data

volumes:
  slack-bridge-data:
```

Add credentials to your `.env`:

```bash
PAPERCLIP_BRIDGE_API_KEY=your-board-api-key
PAPERCLIP_COMPANY_ID=your-company-uuid
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-level-token
```

Start:

```bash
docker compose up --build slack-bridge
```

### Standalone (without Docker)

```bash
npm install
npm run build
cp .env.example .env  # edit with your credentials
npm start
```

## Channel Routing

Edit `config/channels.json` to control where events are posted:

```json
{
  "default": "#agent-updates",
  "routes": [
    { "match": { "action": "approval.created" }, "channel": "#approvals" },
    { "match": { "action": "budget.warning" }, "channel": "#cost-alerts" },
    { "match": { "action": "budget.exhausted" }, "channel": "#cost-alerts" },
    { "match": { "agentId": "agent-ceo-uuid" }, "channel": "#ceo-reports" },
    { "match": { "projectId": "proj-xyz" }, "channel": "#project-alpha" }
  ]
}
```

Routes are evaluated top-down. First match wins, unmatched events go to `default`. Match keys can be any activity log field (`action`, `entityType`, `agentId`) or any key inside the event's `details` object.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PAPERCLIP_API_URL` | Yes | — | Paperclip API base URL |
| `PAPERCLIP_API_KEY` | Yes | — | Board-level API key |
| `PAPERCLIP_COMPANY_ID` | Yes | — | Company UUID to bridge |
| `SLACK_BOT_TOKEN` | Yes | — | Slack bot token (`xoxb-...`) |
| `SLACK_APP_TOKEN` | Yes | — | Slack app-level token (`xapp-...`) |
| `POLL_INTERVAL_MS` | No | `30000` | Activity poll interval in ms |
| `CHANNEL_MAP_PATH` | No | `/config/channels.json` | Path to channel routing config |
| `SQLITE_PATH` | No | `/data/bridge.db` | Path to SQLite database |

## Slash Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/pc-task <title> [--assign <agent>] [--project <name>]` | Create an issue | `/pc-task "Fix login bug" --assign CTO` |
| `/pc-status [filter]` | Show agent statuses | `/pc-status` or `/pc-status CTO` |
| `/pc-costs` | Show cost summary | `/pc-costs` |
| `/pc-pause <agent>` | Pause an agent | `/pc-pause CodexCoder` |
| `/pc-approve <id>` | Approve a request | `/pc-approve apr_abc123` |

## Development

```bash
npm install
npm run dev     # watch mode with tsx
npm test        # run test suite
npm run build   # compile TypeScript
```

## Architecture

```
src/
├── index.ts              # Entry point — wires config, store, client, app, poller
├── config.ts             # Environment variables + channel map loader
├── store.ts              # SQLite — poll cursor + slackTs↔issueId mappings
├── router.ts             # Event → channel routing engine
├── paperclip/
│   ├── client.ts         # Typed Paperclip API client (fetch + Bearer auth)
│   ├── poller.ts         # Activity poll loop + approval polling
│   └── types.ts          # Paperclip API type definitions
└── slack/
    ├── app.ts            # Bolt app init (Socket Mode)
    ├── commands.ts       # Slash command handlers
    ├── actions.ts        # Approval button handlers
    ├── threads.ts        # Thread reply → issue comment forwarding
    └── blocks.ts         # Block Kit message builders
```

**Not an adapter.** This bridge is a communication layer. Agents still execute via their configured adapters (Claude Code, Codex, etc). Paperclip remains the source of truth — Slack is a mirror and input channel.

## License

[MIT](LICENSE)
