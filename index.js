#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ---------------------------------------------------------------------------
// gRPC client — lazy init (created on first tool call, not at startup)
// This ensures the MCP server starts cleanly even when the gRPC service
// is not running. No connection attempt, no error notification on launch.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(__dirname, "protos/translate.proto");
const GRPC_URL = process.env.TRANSLATE_GRPC_URL ?? "localhost:5100";

let _client = null;

function getClient() {
  if (_client) return _client;

  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const { lopatnov: { translate: { v1: proto } } } = grpc.loadPackageDefinition(packageDef);
  _client = new proto.TranslateService(GRPC_URL, grpc.credentials.createInsecure());
  return _client;
}

/** Promisify a unary gRPC call */
function call(method, request) {
  return new Promise((resolve, reject) =>
    getClient()[method](request, (err, response) =>
      err ? reject(err) : resolve(response),
    ),
  );
}

/** Convert gRPC error to human-readable string */
function grpcError(err) {
  const codes = { 2:"UNKNOWN",3:"INVALID_ARGUMENT",5:"NOT_FOUND",7:"PERMISSION_DENIED",
    9:"FAILED_PRECONDITION",12:"UNIMPLEMENTED",13:"INTERNAL",14:"UNAVAILABLE" };
  const name = codes[err.code] ?? `CODE_${err.code}`;
  return `gRPC error ${name}: ${err.details ?? err.message}`;
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "lopatnov-translate", version: "2.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "translate_text",
      description: "Translate text from one language to another using the configured translation model.",
      inputSchema: {
        type: "object",
        properties: {
          text:            { type: "string", description: "Text to translate" },
          source_language: { type: "string", description: "Source language code (BCP-47 e.g. 'uk', 'ru') or 'auto' for auto-detection" },
          target_language: { type: "string", description: "Target language code (BCP-47 e.g. 'en', 'de')" },
          model:           { type: "string", description: "Model key (e.g. 'm2m100_418M'). Omit to use the default model." },
          language_format: { type: "string", enum: ["bcp47","flores200","native"], description: "Format for language codes. Default: bcp47" },
        },
        required: ["text", "target_language"],
      },
    },
    {
      name: "detect_language",
      description: "Detect the language of a text string.",
      inputSchema: {
        type: "object",
        properties: {
          text:            { type: "string", description: "Text to detect the language of" },
          language_format: { type: "string", enum: ["bcp47","flores200","native"], description: "Format for the returned language code. Default: bcp47" },
        },
        required: ["text"],
      },
    },
    {
      name: "translate_localization",
      description: "Translate all string values in a JSON localization file, preserving key structure.",
      inputSchema: {
        type: "object",
        properties: {
          json:                 { type: "string", description: "Source JSON string with keys and string values to translate" },
          source_language:      { type: "string", description: "Source language code (BCP-47)" },
          target_language:      { type: "string", description: "Target language code (BCP-47)" },
          model:                { type: "string", description: "Model key. Omit to use the default model." },
          existing_translation: { type: "string", description: "JSON with already-translated values (same structure). Matching keys will be reused." },
          language_format:      { type: "string", enum: ["bcp47","flores200","native"] },
        },
        required: ["json", "source_language", "target_language"],
      },
    },
    {
      name: "transcribe_audio",
      description: "Transcribe speech from a WAV audio file to text using Whisper.",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Absolute path to the WAV file to transcribe" },
          language:  { type: "string", description: "Language hint (BCP-47 e.g. 'en', 'ru'). Omit or use 'auto' for Whisper auto-detection." },
          language_format: { type: "string", enum: ["bcp47","flores200","native"] },
        },
        required: ["file_path"],
      },
    },
    {
      name: "get_capabilities",
      description: "Get the list of available translation models and service capabilities.",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {

      case "translate_text": {
        const res = await call("TranslateText", {
          text:            args.text,
          source_language: args.source_language ?? "auto",
          target_language: args.target_language,
          model:           args.model ?? "",
          language_format: args.language_format ?? "bcp47",
        });
        const parts = [`**Translation:** ${res.translated_text}`, `**Model used:** ${res.model_used}`];
        if (res.detected_language) parts.push(`**Detected language:** ${res.detected_language}`);
        return { content: [{ type: "text", text: parts.join("\n") }] };
      }

      case "detect_language": {
        const res = await call("DetectLanguage", {
          text:            args.text,
          language_format: args.language_format ?? "bcp47",
        });
        const prob = res.probability ? ` (confidence: ${(res.probability * 100).toFixed(1)}%)` : "";
        return { content: [{ type: "text", text: `**Detected language:** ${res.language}${prob}` }] };
      }

      case "translate_localization": {
        const res = await call("TranslateLocalization", {
          json:                 args.json,
          source_language:      args.source_language,
          target_language:      args.target_language,
          model:                args.model ?? "",
          existing_translation: args.existing_translation ?? "",
          language_format:      args.language_format ?? "bcp47",
        });
        return { content: [{ type: "text", text: `**Strings translated:** ${res.strings_translated}\n\`\`\`json\n${res.json}\n\`\`\`` }] };
      }

      case "transcribe_audio": {
        const audioBytes = readFileSync(args.file_path);
        const res = await call("TranscribeAudio", {
          audio_data:      audioBytes,
          language:        args.language ?? "auto",
          language_format: args.language_format ?? "bcp47",
        });
        const segments = (res.segments ?? [])
          .map(s => `[${s.start_time.toFixed(1)}s – ${s.end_time.toFixed(1)}s] ${s.text}`)
          .join("\n");
        const text = [`**Full text:** ${res.full_text}`];
        if (res.detected_language) text.push(`**Detected language:** ${res.detected_language}`);
        if (segments) text.push(`\n**Segments:**\n${segments}`);
        return { content: [{ type: "text", text: text.join("\n") }] };
      }

      case "get_capabilities": {
        const res = await call("GetCapabilities", {});
        const models = (res.available_models ?? []).join(", ") || "(none)";
        const stt = res.stt_available ? "✅ enabled" : "❌ disabled";
        return { content: [{ type: "text", text: `**Available models:** ${models}\n**Speech-to-text:** ${stt}` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    const message = err.code !== undefined ? grpcError(err) : err.message;
    return { content: [{ type: "text", text: `❌ ${message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
