# Modex

Modex is a desktop workspace for ModelSwitch, Claude Code, and Codex.

Modex is available as an unsigned macOS test build, not a production release. The desktop terminal integration requires an existing Claude Code or Codex installation. Packaged startup and the login screen are checked in CI; end-to-end account login and real task execution still need testing on a Mac. Do not use this preview with production credentials or sensitive data.

The packaged app launches its own local workspace service with SQLite and authenticates against the existing ModelSwitch account service. The upstream hosted account and legacy OAuth integrations are disabled. Development uses a local workspace endpoint and the model gateway at `https://api.modelswitch.org/v1`. Inherited integrations and configuration still require a network and privacy audit before production release.

Development notes and known gaps are in [docs/modelswitch-preview.md](docs/modelswitch-preview.md).

Modex incorporates and modifies code from [Eigent](https://github.com/eigent-ai/eigent), distributed under the Apache License 2.0. See [LICENSE](LICENSE) and the copyright notices in the source files.
