import { vi } from "vitest";

// Mock for @anthropic-ai/claude-agent-sdk
export const query = vi.fn().mockImplementation(() => {
  // Return an async generator that yields a result message
  return (async function* () {
    yield {
      type: "result",
      subtype: "success",
      result: "Mock agent output for testing.",
      is_error: false,
      duration_ms: 100,
      num_turns: 1,
    };
  })();
});
