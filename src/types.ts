export interface MstackConfig {
  /** Project name — used in workflow metadata */
  name: string;

  /** Output directory — default ".mstack/" */
  outputDir: string;

  /** Default model for all phases — can be overridden per phase */
  model: string;

  /** Orchestration mode: who drives the phase loop */
  orchestration: "prompt" | "code" | "interactive";

  /** Permission mode for Claude Code tool approvals — default "acceptEdits"
   *  - "default": prompt user for each tool (interactive approval)
   *  - "acceptEdits": auto-approve file operations (Edit, Write, Bash writes)
   *  - "bypassPermissions": auto-approve ALL tools (use with caution)
   */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";

  /** Phase definitions — order of keys determines execution order */
  phases: Record<string, PhaseConfig>;

  /** Max retries per phase before stopping — default 2 */
  maxRetries: number;

  /** TDD settings */
  tdd: {
    enabled: boolean;
  };
}

export interface PhaseConfig {
  /** Whether this phase runs — default true */
  enabled: boolean;

  /** Skill file name (resolves to .mstack/skills/{skill}.md)
   *  or relative path (starts with "./") for custom skills */
  skill: string;

  /** Model override for this phase */
  model?: string;

  /** Orchestration mode override for this phase */
  orchestration?: "prompt" | "code" | "interactive";

  /** Input context for this phase:
   *  - null/undefined: no prior context
   *  - string: path to a single output doc from a previous phase (e.g. "analysis.md")
   *  - Record<string, string>: multiple named inputs (e.g. { plan: "plan.md", impl: "implementation.md" })
   */
  input?: null | string | Record<string, string>;

  /** Pre-phase hooks — run before the phase executes
   *  - "human": pause and ask user for input/approval
   *  - "review": run an additional review step
   *  - string path: execute a custom script
   */
  pre?: string[];

  /** Post-phase hooks — run after the phase completes */
  post?: string[];

  /** Per-phase skill overrides — merged into the skill at runtime */
  overrides?: {
    /** Additional constraints appended to the skill's Constraints section */
    constraints?: string[];
    /** Additional context prepended to the skill's Task section */
    context?: string;
  };

  /** Allowed tools for this phase (v1: prompt-level enforcement only)
   *  e.g. ["Read", "Glob", "Grep", "Bash"] */
  tools?: string[];

  /** Per-phase permission mode override */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
}
