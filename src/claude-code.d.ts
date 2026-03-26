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
    /** Enable streaming of partial messages during generation */
    includePartialMessages?: boolean;
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

  interface SDKStreamEvent {
    type: "stream_event";
    event: {
      type: "content_block_start" | "content_block_delta" | "content_block_stop" | "message_start" | "message_delta" | "message_stop";
      delta?: {
        type: "text_delta" | "input_json_delta";
        text?: string;
        partial_json?: string;
      };
      content_block?: {
        type: "text" | "tool_use";
        name?: string;
      };
      [key: string]: unknown;
    };
    parent_tool_use_id: string | null;
    uuid: string;
    session_id: string;
    [key: string]: unknown;
  }

  type SDKMessage =
    | SDKResultMessage
    | SDKAssistantMessage
    | SDKStreamEvent
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
