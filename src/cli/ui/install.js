import { DEFAULT_INSTALL_STEPS } from "../constants.js";

export function installCommandDescriptor() {
  return {
    title: "Claude Code Installer",
    steps: DEFAULT_INSTALL_STEPS,
  };
}
