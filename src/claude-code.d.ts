declare module "@anthropic-ai/claude-agent-sdk" {
  interface QueryOptions {
    abortController?: AbortController;
    allowedTools?: string[];
    cwd?: string;
    disallowedTools?: string[];
    model?: string;
    systemPrompt?: string | {
      type: "preset";
      preset: "claude_code";
      append?: string;
    };
    maxTurns?: number;
  }

  interface SDKResultSuccess {
    type: "result";
    subtype: "success";
    result: string;
    duration_ms: number;
    is_error: boolean;
    num_turns: number;
    [key: string]: unknown;
  }

  interface SDKResultError {
    type: "result";
    subtype: "error";
    error: string;
    is_error: boolean;
    [key: string]: unknown;
  }

  type SDKResultMessage = SDKResultSuccess | SDKResultError;

  interface SDKMessage {
    type: string;
    [key: string]: unknown;
  }

  interface Query extends AsyncGenerator<SDKMessage, void> {
    interrupt(): Promise<void>;
  }

  export function query(params: {
    prompt: string;
    options?: QueryOptions;
  }): Query;
}
