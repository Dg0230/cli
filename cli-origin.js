// === Section: Bundler runtime helpers ===
// === Section: Update workflow ===
// === Section: Install command UI bootstrap ===
// === Section: Settings and configuration loaders ===
// === Section: CLI lifecycle orchestration ===
// === Section: Terminal I/O helpers ===
// === Section: Argument parsing and command registration ===
    // --- MCP server management commands ---
    // --- Plugin lifecycle commands ---
    // --- Plugin marketplace management ---
    }),
    // --- Legacy installer maintenance commands ---
    A.command("migrate-installer").description("Migrate from global npm installation to local installation").helpOption("-h, --help", "Display help for command").action(async () => {
    }),
    // --- Authentication utilities ---
    A.command("setup-token").description("Set up a long-lived authentication token (requires Claude subscription)").helpOption("-h, --help", "Display help for command").action(async () => {
    // --- CLI diagnostics commands ---
    }),
    // --- Self-update and installation commands ---
    A.command("update").description("Check for updates and install if available").helpOption("-h, --help", "Display help for command").action(LyQ), A.command("install [target]").description("Install Claude Code native build. Use [target] to specify version (stable, latest, or specific version)").option("--force", "Force installation even if already installed").helpOption("-h, --help", "Display help for command").action(async (W, J) => {
