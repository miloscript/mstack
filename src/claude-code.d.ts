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
    /** Permission mode for tool approvals:
     *  - "default": prompt user for each tool (SDK default)
     *  - "acceptEdits": auto-approve file operations (Edit, Write, Bash writes)
     *  - "bypassPermissions": auto-approve ALL tools (requires allowDangerouslySkipPermissions)
     */
    permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
    /** Required safety flag when using permissionMode: "bypassPermissions" */
    allowDangerouslySkipPermissions?: boolean;
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

  interface SDKAssistantMessage {
    type: "assistant";
    content: Array<{
      type: "text" | "tool_use";
      text?: string;
      name?: string;
      input?: unknown;
    }>;
    [key: string]: unknown;
  }

  interface SDKToolUseSummaryMessage {
    type: "tool_use_summary";
    tool_name: string;
    summary: string;
    [key: string]: unknown;
  }

  interface SDKStatusMessage {
    type: "status";
    message: string;
    [key: string]: unknown;
  }

  interface SDKSystemMessage {
    type: "system";
    subtype: "init" | "compact_boundary";
    [key: string]: unknown;
  }

  type SDKMessage =
    | SDKResultMessage
    | SDKAssistantMessage
    | SDKToolUseSummaryMessage
    | SDKStatusMessage
    | SDKSystemMessage
    | { type: string; [key: string]: unknown };

  interface Query extends AsyncGenerator<SDKMessage, void> {
    interrupt(): Promise<void>;
  }

  export function query(params: {
    prompt: string;
    options?: QueryOptions;
  }): Query;
}
