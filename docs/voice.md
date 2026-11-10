# Voice input and talk-back

Voice input streams 16 kHz mono PCM to Amazon Transcribe in `us-east-1`. Turn-based talk-back uses Bedrock to interpret a seller's answer and Amazon Polly to speak code-checked replies. Audio goes to Transcribe; the transcript or typed answer, current question and item and cost context can go to Bedrock, and reply text goes to Polly. Audio and transcripts are not stored or logged. Avoid personal information in answers. The interview engine chooses each field, checks values and requires confirmation before calculation. Typing retains confirmed answers if voice fails.

Both `WTES_VOICE_ENABLED=true` and `WTES_VOICE_TALKBACK_ENABLED=true` are required. `WTES_VOICE_CHECK_MODEL` defaults to `us.amazon.nova-2-lite-v1:0`; Nova reasoning is enabled at low effort. A refused configured Claude model falls back to Nova for that turn. Provider calls retain the production OIDC role and AI allowance. The role `wtes-bedrock-production` needs the following in addition to Bedrock access:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["transcribe:StartStreamTranscription", "polly:SynthesizeSpeech"],
    "Resource": "*"
  }]
}
```

Limits are 80 transcribed turns and 6,000 spoken characters per identity per UTC day, with monthly shared limits of 600 audio minutes and 300,000 spoken characters. Blob reservations occur before provider calls and are not refunded after failures. The identity is the existing signed-in user or judge-cookie identity. Polly uses Amy for GBP and Ruth otherwise.

Production builds obtain pinned VAD and ONNX packages and copy their worklet, model, JavaScript and WASM assets under `/voice-assets/`; a missing asset fails the build. The browser uses one ONNX thread and same-origin asset paths. (history, 3 November 2026) Local sandbox registry access was unavailable; real microphone capture, speech playback and end-to-end latency were not established by that local build. Current availability depends on configuration and browser microphone permission; typing is the fallback. Production installs use the committed `voice-assets/package-lock.json`. The temporary public lock receipt was removed and its URL was verified to return HTTP 404.
