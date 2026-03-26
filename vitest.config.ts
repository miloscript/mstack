import { defineConfig } from "vitest/config";
import * as path from "node:path";

export default defineConfig({
  test: {
    alias: {
      "@anthropic-ai/claude-agent-sdk": path.resolve(
        import.meta.dirname,
        "tests",
        "__mocks__",
        "claude-code.ts",
      ),
    },
  },
});
