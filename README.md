# @lopatnov/translate-mcp

[![npm](https://img.shields.io/npm/dt/@lopatnov/translate-mcp)](https://www.npmjs.com/package/@lopatnov/translate-mcp)
[![NPM version](https://badge.fury.io/js/%40lopatnov%2Ftranslate-mcp.svg)](https://www.npmjs.com/package/@lopatnov/translate-mcp)
[![License](https://img.shields.io/github/license/lopatnov/translate)](https://github.com/lopatnov/translate/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/lopatnov/translate)](https://github.com/lopatnov/translate/stargazers)

MCP server for [Lopatnov.Translate](https://github.com/lopatnov/translate) — brings self-hosted speech-to-text, text translation, and language detection into Claude and any MCP-compatible AI client. All inference runs **locally** — no cloud, no API keys, no data leaves your machine.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [AI Client Configuration](#ai-client-configuration)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Windsurf](#windsurf)
  - [VS Code (GitHub Copilot)](#vs-code-github-copilot)
  - [Zed](#zed)
- [Environment Variables](#environment-variables)
- [Tools](#tools)
- [Contributing](#contributing)
- [Built With](#built-with)
- [License](#license)

## Prerequisites

1. **Node.js 20+**
2. **Lopatnov.Translate gRPC service** running (default: `localhost:5100`)

   Start with Docker:

   ```bash
   git clone https://github.com/lopatnov/translate.git
   cd translate
   # Download models — see docs/models.md
   docker compose -f docker/docker-compose.yml up
   ```

## Installation

```bash
npm install -g @lopatnov/translate-mcp
```

Or run without installing:

```bash
npx @lopatnov/translate-mcp
```

## AI Client Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "translate": {
      "command": "npx",
      "args": ["-y", "@lopatnov/translate-mcp"],
      "env": {
        "TRANSLATE_GRPC_URL": "localhost:5100"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add translate -e TRANSLATE_GRPC_URL=localhost:5100 -- npx -y @lopatnov/translate-mcp
```

Manage the server:

```bash
claude mcp list
claude mcp get translate
claude mcp remove translate
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "translate": {
      "command": "npx",
      "args": ["-y", "@lopatnov/translate-mcp"],
      "env": {
        "TRANSLATE_GRPC_URL": "localhost:5100"
      }
    }
  }
}
```

Or via **Cursor Settings → MCP → Add Server**.

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "translate": {
      "command": "npx",
      "args": ["-y", "@lopatnov/translate-mcp"],
      "env": {
        "TRANSLATE_GRPC_URL": "localhost:5100"
      }
    }
  }
}
```

Or via **Windsurf Settings → Cascade → MCP Servers → Add**.

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "translate": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@lopatnov/translate-mcp"],
      "env": {
        "TRANSLATE_GRPC_URL": "localhost:5100"
      }
    }
  }
}
```

Or via **Command Palette → MCP: Add Server**.

### Zed

Add to Zed `settings.json` (**Zed → Settings → Open Settings**):

```json
{
  "context_servers": {
    "translate": {
      "command": {
        "path": "npx",
        "args": ["-y", "@lopatnov/translate-mcp"]
      },
      "settings": {
        "TRANSLATE_GRPC_URL": "localhost:5100"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TRANSLATE_GRPC_URL` | `localhost:5100` | Host and port of the Lopatnov.Translate gRPC service |

## Tools

| Tool | Description |
|---|---|
| `translate_text` | Translate a string between any two supported languages |
| `detect_language` | Detect the language of a text string |
| `translate_localization` | Translate all strings in a JSON i18n file, preserving key structure |
| `transcribe_audio` | Transcribe a WAV audio file to text (requires Whisper model) |
| `get_capabilities` | List available translation models and service status |

### `translate_text`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | ✅ | Text to translate |
| `target_language` | string | ✅ | Target language code, e.g. `"uk"`, `"de"` |
| `source_language` | string | — | Source language, or `"auto"` for auto-detection (default) |
| `model` | string | — | Model name from config, e.g. `"m2m100_418M"`. Omit for default |
| `language_format` | string | — | `"bcp47"` (default), `"flores200"`, or `"native"` |

### `detect_language`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | ✅ | Text to detect |
| `language_format` | string | — | Format of the returned code. Default: `"bcp47"` |

### `translate_localization`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `json` | string | ✅ | Source JSON as a string |
| `source_language` | string | ✅ | Source language (BCP-47) |
| `target_language` | string | ✅ | Target language (BCP-47) |
| `model` | string | — | Model name. Omit for default |
| `existing_translation` | string | — | Previously translated JSON — matching keys are reused |
| `language_format` | string | — | Language code format. Default: `"bcp47"` |

### `transcribe_audio`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `file_path` | string | ✅ | Absolute path to the WAV file |
| `language` | string | — | Language hint (BCP-47), or `"auto"` for Whisper auto-detection |
| `language_format` | string | — | Format of the returned detected language. Default: `"bcp47"` |

### `get_capabilities`

Returns available translation models and whether STT is enabled. No parameters.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- Bug reports → [open an issue](https://github.com/lopatnov/translate/issues)
- Found it useful? A [star on GitHub](https://github.com/lopatnov/translate/stargazers) helps others discover the project

---

## Built With

- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server framework
- [@grpc/grpc-js](https://github.com/grpc/grpc-node) — gRPC client for Node.js
- [@grpc/proto-loader](https://github.com/grpc/grpc-node/tree/master/packages/proto-loader) — Protocol Buffer loader
- [Lopatnov.Translate](https://github.com/lopatnov/translate) — self-hosted gRPC translation backend

---

## License

[Apache-2.0](https://github.com/lopatnov/translate/blob/main/LICENSE) © 2026 [Oleksandr Lopatnov](https://github.com/lopatnov) · [LinkedIn](https://www.linkedin.com/in/lopatnov/)
