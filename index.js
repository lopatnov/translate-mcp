#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";
import { homedir, tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// gRPC client — lazy init (created on first tool call, not at startup)
// This ensures the MCP server starts cleanly even when the gRPC service
// is not running. No connection attempt, no error notification on launch.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(__dirname, "protos/translate.proto");
const GRPC_URL = process.env.TRANSLATE_GRPC_URL ?? "localhost:5100";
const AUDIO_BASE_DIR = resolve(process.env.TRANSCRIBE_BASE_DIR ?? homedir());
const SYNTH_OUTPUT_DIR = resolve(process.env.SYNTHESIZE_OUTPUT_DIR ?? join(tmpdir(), "translate-mcp"));
// Create the output directory once at startup rather than on every tool call.
mkdirSync(SYNTH_OUTPUT_DIR, { recursive: true });

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

/**
 * Validates that `filePath` is inside AUDIO_BASE_DIR and ends in `.wav`,
 * then reads and returns its bytes.
 * Returns `{ bytes: Buffer }` on success or `{ errorResult: <tool error> }` on failure.
 */
function readAudioFile(filePath) {
  const resolvedPath = resolve(filePath);
  if (!resolvedPath.startsWith(AUDIO_BASE_DIR + sep)) {
    return { errorResult: { content: [{ type: "text", text: `❌ File must be inside ${AUDIO_BASE_DIR}` }], isError: true } };
  }
  if (!resolvedPath.toLowerCase().endsWith(".wav")) {
    return { errorResult: { content: [{ type: "text", text: "❌ Only .wav files are supported" }], isError: true } };
  }
  return { bytes: readFileSync(resolvedPath) };
}

/** Convert gRPC error to human-readable string */
function grpcError(err) {
  const codes = { 2:"UNKNOWN",3:"INVALID_ARGUMENT",5:"NOT_FOUND",7:"PERMISSION_DENIED",
    9:"FAILED_PRECONDITION",12:"UNIMPLEMENTED",13:"INTERNAL",14:"UNAVAILABLE" };
  const name = codes[err.code] ?? `CODE_${err.code}`;
  return `gRPC error ${name}: ${err.details ?? err.message}`;
}

function toolError(err) {
  const message = err.code === undefined ? err.message : grpcError(err);
  return { content: [{ type: "text", text: `❌ ${message}` }], isError: true };
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: "lopatnov-translate", version: "3.0.0" },
);

const langFormat = z.enum(["bcp47", "flores200", "native"]);

server.registerTool("translate_text", {
  description: "Translate text from one language to another using the configured translation model.",
  inputSchema: {
    text:            z.string().describe("Text to translate"),
    source_language: z.string().optional().describe("Source language code (BCP-47 e.g. 'uk', 'ru') or 'auto' for auto-detection"),
    target_language: z.string().describe("Target language code (BCP-47 e.g. 'en', 'de')"),
    model:           z.string().optional().describe("Model key (e.g. 'm2m100_418M'). Omit to use the default model."),
    context:         z.string().optional().describe("Optional free-form context hint for the translation (used by LLM-based models)."),
    language_format: langFormat.optional().describe("Format for language codes. Default: bcp47"),
  },
}, async (args) => {
  try {
    const res = await call("TranslateText", {
      text:            args.text,
      source_language: args.source_language ?? "auto",
      target_language: args.target_language,
      model:           args.model ?? "",
      context:         args.context ?? "",
      language_format: args.language_format ?? "bcp47",
    });
    const parts = [`**Translation:** ${res.translated_text}`, `**Model used:** ${res.model_used}`];
    if (res.detected_language) parts.push(`**Detected language:** ${res.detected_language}`);
    return { content: [{ type: "text", text: parts.join("\n") }] };
  } catch (err) {
    return toolError(err);
  }
});

server.registerTool("detect_language", {
  description: "Detect the language of a text string.",
  inputSchema: {
    text:            z.string().describe("Text to detect the language of"),
    language_format: langFormat.optional().describe("Format for the returned language code. Default: bcp47"),
  },
}, async (args) => {
  try {
    const res = await call("DetectLanguage", {
      text:            args.text,
      language_format: args.language_format ?? "bcp47",
    });
    const prob = res.probability ? ` (confidence: ${(res.probability * 100).toFixed(1)}%)` : "";
    return { content: [{ type: "text", text: `**Detected language:** ${res.language}${prob}` }] };
  } catch (err) {
    return toolError(err);
  }
});

server.registerTool("translate_localization", {
  description: "Translate all string values in a JSON localization file, preserving key structure.",
  inputSchema: {
    json:                 z.string().describe("Source JSON string with keys and string values to translate"),
    source_language:      z.string().describe("Source language code (BCP-47)"),
    target_language:      z.string().describe("Target language code (BCP-47)"),
    model:                z.string().optional().describe("Model key. Omit to use the default model."),
    existing_translation: z.string().optional().describe("JSON with already-translated values (same structure). Matching keys will be reused."),
    context:              z.string().optional().describe("Optional JSON with context hints per key (used by LLM-based models)."),
    language_format:      langFormat.optional(),
  },
}, async (args) => {
  try {
    const res = await call("TranslateLocalization", {
      json:                 args.json,
      source_language:      args.source_language,
      target_language:      args.target_language,
      model:                args.model ?? "",
      existing_translation: args.existing_translation ?? "",
      context:              args.context ?? "",
      language_format:      args.language_format ?? "bcp47",
    });
    return { content: [{ type: "text", text: `**Strings translated:** ${res.strings_translated}\n\`\`\`json\n${res.json}\n\`\`\`` }] };
  } catch (err) {
    return toolError(err);
  }
});

server.registerTool("transcribe_audio", {
  description: "Transcribe speech from a WAV audio file to text using Whisper.",
  inputSchema: {
    file_path:       z.string().describe("Absolute path to the WAV file to transcribe"),
    language:        z.string().optional().describe("Language hint (BCP-47 e.g. 'en', 'ru'). Omit or use 'auto' for Whisper auto-detection."),
    language_format: langFormat.optional(),
  },
}, async (args) => {
  try {
    const { bytes: audioBytes, errorResult } = readAudioFile(args.file_path);
    if (errorResult) return errorResult;
    const res = await call("TranscribeAudio", {
      audio_data:      audioBytes,
      language:        args.language ?? "auto",
      audio_format:    "",
      language_format: args.language_format ?? "bcp47",
    });
    const segments = (res.segments ?? [])
      .map(s => `[${s.start_time.toFixed(1)}s – ${s.end_time.toFixed(1)}s] ${s.text}`)
      .join("\n");
    const text = [`**Full text:** ${res.full_text}`];
    if (res.detected_language) text.push(`**Detected language:** ${res.detected_language}`);
    if (segments) text.push(`\n**Segments:**\n${segments}`);
    return { content: [{ type: "text", text: text.join("\n") }] };
  } catch (err) {
    return toolError(err);
  }
});

server.registerTool("synthesize_speech", {
  description: "Convert text to speech using the configured Piper TTS voice and save the result as a WAV file.",
  inputSchema: {
    text:            z.string().describe("Text to synthesize"),
    language:        z.string().optional().describe("BCP-47 language code (e.g. 'en', 'ru', 'uk'). Must match a configured Piper voice."),
    voice:           z.string().optional().describe("Speaker name for multi-speaker voices (e.g. 'lada', 'mykyta', 'tetiana'). Omit for default speaker."),
    speed:           z.number().min(0.5).max(2).optional().describe("Speech speed multiplier (0.5 = slow, 1.0 = normal, 2.0 = fast). Default: 1.0"),
    language_format: langFormat.optional().describe("Format for the language code. Default: bcp47"),
  },
}, async (args) => {
  try {
    const res = await call("SynthesizeSpeech", {
      text:            args.text,
      language:        args.language ?? "",
      voice:           args.voice ?? "",
      speed:           args.speed ?? 1,
      language_format: args.language_format ?? "bcp47",
    });

    const outputPath = join(SYNTH_OUTPUT_DIR, `tts-${randomUUID()}.wav`);
    // res.audio_data is already a Buffer from the gRPC client — no copy needed.
    writeFileSync(outputPath, res.audio_data);

    const parts = [
      `**Audio saved:** ${outputPath}`,
      `**Sample rate:** ${res.sample_rate} Hz`,
    ];
    if (args.language) parts.push(`**Language:** ${args.language}`);
    if (args.voice)    parts.push(`**Voice:** ${args.voice}`);
    return { content: [{ type: "text", text: parts.join("\n") }] };
  } catch (err) {
    return toolError(err);
  }
});

server.registerTool("translate_audio", {
  description:
    "Translate speech from a WAV file end-to-end: transcribe (Whisper) → translate (NLLB/M2M) → synthesize (Piper). Returns the transcription, translated text, and a path to the output WAV file.",
  inputSchema: {
    file_path:       z.string().describe("Absolute path to the source WAV file"),
    source_language: z.string().optional().describe("Source language (BCP-47 e.g. 'en'). Omit or use 'auto' for Whisper auto-detection."),
    target_language: z.string().describe("Target language (BCP-47 e.g. 'uk', 'ru')"),
    target_voice:    z.string().optional().describe("Speaker name for multi-speaker Piper voices (e.g. 'lada'). Omit for default."),
    language_format: langFormat.optional(),
  },
}, async (args) => {
  try {
    const { bytes: audioBytes, errorResult } = readAudioFile(args.file_path);
    if (errorResult) return errorResult;
    const res = await call("TranslateAudio", {
      audio_data:      audioBytes,
      source_language: args.source_language ?? "auto",
      target_language: args.target_language,
      audio_format:    "",
      target_voice:    args.target_voice ?? "",
      language_format: args.language_format ?? "bcp47",
    });

    const outputPath = join(SYNTH_OUTPUT_DIR, `translated-${randomUUID()}.wav`);
    // res.translated_audio is already a Buffer — no copy needed.
    writeFileSync(outputPath, res.translated_audio);

    const parts = [
      `**Transcription:** ${res.transcription}`,
      `**Translated text:** ${res.translated_text}`,
      `**Output audio:** ${outputPath}`,
      `**Sample rate:** ${res.sample_rate} Hz`,
    ];
    return { content: [{ type: "text", text: parts.join("\n") }] };
  } catch (err) {
    return toolError(err);
  }
});

server.registerTool("get_capabilities", {
  description: "Get the list of available translation models and service capabilities.",
}, async () => {
  try {
    const res = await call("GetCapabilities", {});
    const models = (res.available_models ?? []).join(", ") || "(none)";
    const voices = (res.available_voices ?? []).join(", ") || "(none)";
    const stt = res.stt_available ? "✅ enabled" : "❌ disabled";
    const tts = res.tts_available ? "✅ enabled" : "❌ disabled";
    const parts = [
      `**Available models:** ${models}`,
      `**Speech-to-text:** ${stt}`,
      `**Text-to-speech:** ${tts}`,
    ];
    if (res.tts_available) parts.push(`**Available voices:** ${voices}`);
    return { content: [{ type: "text", text: parts.join("\n") }] };
  } catch (err) {
    return toolError(err);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
