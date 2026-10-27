# Modex

Modex is a desktop workspace for ModelSwitch, Claude Code, and Codex.

This repository is under active development and is not ready for production or distribution. The desktop terminal integration requires an existing Claude Code or Codex installation. The workspace service, isolated local data directory, desktop update flow, and macOS installer are not yet validated. Do not use this preview with production credentials.

The current development configuration points the workspace API to `127.0.0.1:3001` and the model gateway to `https://api.modelswitch.org/v1`. The upstream hosted deployment and legacy OAuth integration are disabled. The application still contains inherited integrations and configuration that require a network and privacy audit before release.

Development notes and known gaps are in [docs/modelswitch-preview.md](docs/modelswitch-preview.md).

Modex incorporates and modifies code from [Eigent](https://github.com/eigent-ai/eigent), distributed under the Apache License 2.0. See [LICENSE](LICENSE) and the copyright notices in the source files.
