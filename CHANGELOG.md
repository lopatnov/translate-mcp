# Changelog

All notable changes to `@lopatnov/translate-mcp` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.0.0] — 2026-05-15

### Added
- **`synthesize_speech`** — new tool: converts text to speech via Piper TTS (`SynthesizeSpeech` RPC). Saves WAV to `$TMPDIR/translate-mcp/` and returns the file path + sample rate. Requires `espeak-ng` installed on the server host (GPL v3, called as subprocess).
- **`translate_audio`** — new tool: end-to-end Speech→Speech translation (`TranslateAudio` RPC). Transcribes a WAV file (Whisper), translates the text (NLLB/M2M), synthesizes the result (Piper). Returns transcription, translated text, and output WAV path.
- **`npm run sync-proto`** — copies `translate.proto` from the backend project (`../../src/Lopatnov.Translate.Grpc/Protos/translate.proto`).
- `context` parameter added to `translate_text` and `translate_localization` (optional, for LLM-based models).
- `get_capabilities` now reports `tts_available` and `available_voices`.

### Fixed
- **Proto field number misalignment** — all four response messages had wrong field numbers vs the backend:
  - `TranslateTextResponse`: `model_used` ↔ `detected_language` were swapped
  - `TranslateLocalizationResponse`: `json` ↔ `strings_translated` were swapped
  - `TranscribeAudioResponse`: `full_text` ↔ `segments` were swapped
  - `GetCapabilitiesResponse`: `available_models` was on reserved field 1 (now field 3)
- `TranscriptionSegment` field order corrected (`text`, `start_time`, `end_time`).

### Changed
- Server version bumped `2.0.0 → 3.0.0` (new tools, proto fixes are breaking changes).
- Package description updated to mention TTS.
- Keywords: added `piper`, `text-to-speech`.

---

## [2.0.0] — 2025-xx-xx

Initial public release with `translate_text`, `detect_language`, `translate_localization`, `transcribe_audio`, `get_capabilities`.
