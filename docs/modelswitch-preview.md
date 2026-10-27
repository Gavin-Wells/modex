# ModelSwitch integration preview

This checkout starts from Eigent main at b764e42bd8a4542cbb237dd45436c172f96e747b. The top bar offers a ModelSwitch terminal for an already installed Claude Code or Codex CLI. The user selects a project folder, enters a ModelSwitch key, and launches the selected tool. Closing or ending the session disposes the terminal. Keys are passed to the child environment, not command arguments or shell history, and are not saved by this integration.

The existing OpenAI-compatible model configuration is prefilled with the ModelSwitch endpoint. Modex's build configuration selects a service on `127.0.0.1:3001`; the old upstream OAuth and hosted deployment integrations are disabled. The separate local backend setup in `server/README_EN.md` is not bundled or verified as part of this preview. Other inherited integrations and network destinations still require an audit before release.

This is not a production release: automatic CLI installation, balance, self-check, feedback, local service packaging, updater validation, Windows CLI launch, and a full Mac GUI test remain to be implemented or verified. The existing `~/.eigent` storage paths still need isolation. Claude Code and Codex both require a separate installation. The web preview cannot launch native terminals.

UI uses Eigent's Dialog, Button, Input, Select and DsText primitives with semantic spacing. The terminal uses Eigent's existing terminal screen and the existing fixed terminal viewport; Chinese text is currently not localized. Automated checks cover the launch options and the dialog's selection/start/disposal flow. Light/dark visual review, zoom, keyboard navigation, and narrow desktop windows have not yet been checked.
