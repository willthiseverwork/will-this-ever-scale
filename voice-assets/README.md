# Voice asset dependencies

The production build prepares same-origin browser assets from `@ricky0123/vad-web` 0.0.31 (ISC licence) and `onnxruntime-web` 1.22.0 (MIT licence). The direct versions are pinned in `package.json`. A temporary generated lock receipt is published with the assets so its complete dependency graph can be captured and committed; after that, production uses `npm ci`. The browser selects one ONNX thread and does not depend on cross-origin isolation.
