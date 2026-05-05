# translate-mcp

MCP server for [Lopatnov.Translate](https://github.com/lopatnov/translate) — exposes the gRPC translation service as MCP tools for use with Claude Desktop or any MCP-compatible client.

## Tools

| Tool | Description |
|---|---|
| `translate_text` | Translate text between languages |
| `detect_language` | Detect the language of a text string |
| `translate_localization` | Translate all strings in a JSON i18n file |
| `transcribe_audio` | Transcribe a WAV file to text (requires Whisper) |
| `get_capabilities` | List available models and service status |

## Requirements

- Node.js 20+
- [Lopatnov.Translate](https://github.com/lopatnov/translate) gRPC service running (default port 5100)

## Setup

```bash
npm install
```

## Claude Desktop configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "translate": {
      "command": "node",
      "args": ["C:/projects/translate/clients/translate-mcp/index.js"],
      "env": {
        "TRANSLATE_GRPC_URL": "localhost:5100"
      }
    }
  }
}
```

`claude_desktop_config.json` location:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `TRANSLATE_GRPC_URL` | `localhost:5100` | Address of the gRPC service |
