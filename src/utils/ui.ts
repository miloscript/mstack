/**
 * ui.ts — pure ANSI terminal UI utilities for mstack CLI.
 *
 * No external dependencies. Uses ANSI escape codes for spinner
 * animation, colours, and line-clearing.
 */

import * as fs from "node:fs";

// ── ANSI helpers ────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// ── Spinner ──────────────────────────────────────────────────────────────────

export interface Spinner {
  /** Begin animating the spinner in the terminal. */
  start(): void;
  /** Stop the spinner and clear the line. */
  stop(): void;
  /** Stop the spinner with an error indicator and message. */
  fail(msg?: string): void;
  /** Clear the current spinner line without stopping the interval. */
  clear(): void;
}

/**
 * Creates an ANSI spinner that writes to stdout.
 * The spinner animates every 80ms. Call start() to begin and stop()/fail()
 * to end it. Both stop and fail are idempotent.
 */
export function createSpinner(label: string): Spinner {
  let frame = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const clear = () => {
    process.stdout.write("\r\x1b[K");
  };

  const start = () => {
    if (stopped) return;
    if (interval) return; // already started
    interval = setInterval(() => {
      if (!stopped) {
        process.stdout.write(
          `\r  ${CYAN}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${RESET} ${label}`,
        );
        frame++;
      }
    }, 80);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    clear();
  };

  const fail = (msg?: string) => {
    if (stopped) return;
    stopped = true;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    clear();
    if (msg) {
      process.stderr.write(`  ${RED}✗${RESET} ${msg}\n`);
    }
  };

  return { start, stop, fail, clear };
}

// ── Phase output helpers ─────────────────────────────────────────────────────

/**
 * Formats a phase header line (e.g. "▶ analysis" or "▶ plan (interactive)").
 */
export function formatPhaseHeader(
  phaseName: string,
  isInteractive: boolean,
): string {
  const suffix = isInteractive ? ` ${DIM}(interactive)${RESET}` : "";
  return `\n${BOLD}▶ Starting ${phaseName} phase${RESET}${suffix}...`;
}

/**
 * Prints a phase-complete message with optional duration.
 */
export function printPhaseComplete(
  phaseName: string,
  durationMs?: number,
): void {
  const timing =
    durationMs !== undefined
      ? ` ${DIM}(${formatDuration(durationMs)})${RESET}`
      : "";
  console.log(`  ${GREEN}✓${RESET} ${phaseName} complete${timing}`);
}

/**
 * Prints a phase-failed message.
 */
export function printPhaseFailed(
  phaseName: string,
  attempts: number,
): void {
  console.log(
    `\n${RED}✗${RESET} Workflow stopped: ${phaseName} phase failed after ${attempts} attempt${
      attempts !== 1 ? "s" : ""
    }.`,
  );
}

/**
 * Prints a phase-skipped message (resume support).
 */
export function printPhaseSkipped(phaseName: string): void {
  console.log(
    `  ${DIM}⏭  Skipping ${phaseName} (already complete)${RESET}`,
  );
}

/**
 * Prints the workflow summary at the end of a successful run.
 */
export function printWorkflowSummary(workflowDir: string): void {
  console.log(`\n${BOLD}${"═".repeat(60)}${RESET}`);
  console.log(`  ${GREEN}${BOLD}Workflow complete!${RESET}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`\n  ${DIM}Output:${RESET} ${workflowDir}`);

  try {
    const files = fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith(".md"));
    console.log(`  ${DIM}Phase outputs: ${files.length} documents${RESET}`);
    for (const f of files) {
      console.log(`    ${CYAN}·${RESET} ${f}`);
    }
  } catch {
    // Ignore if directory read fails
  }
  console.log("");
}

/**
 * Formats milliseconds into a human-readable duration string.
 * e.g. 65000 → "1m5s", 5000 → "5s", 500 → "0s"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

/**
 * Prints the permission-error notice with guidance on how to fix it.
 */
export function printPermissionError(
  phaseName: string,
  details: string,
): void {
  console.log(
    `\n${RED}${BOLD}⚠  Permission Error in phase "${phaseName}"${RESET}`,
  );
  console.log(
    `\n  The agent was denied permission to perform an action.`,
  );
  console.log(
    `  Workflow has been stopped and status set to "permission-error".\n`,
  );
  console.log(`  ${YELLOW}To fix:${RESET}`);
  console.log(`    1. Review the error details below`);
  console.log(
    `    2. Add the missing permission to .claude/settings.local.json`,
  );
  console.log(
    `       (or to the \`permissions\` array in mstack.config.js)`,
  );
  console.log(
    `    3. Re-run: ${BOLD}mstack resume <workflow-slug>${RESET}\n`,
  );
  if (details) {
    console.log(
      `  ${DIM}Details: ${details.substring(0, 300)}${RESET}\n`,
    );
  }
}

/**
 * Prints a retry notice.
 */
export function printRetry(
  phaseName: string,
  attempt: number,
  maxRetries: number,
): void {
  console.log(
    `  ${YELLOW}↻${RESET} Retry ${attempt}/${maxRetries} for ${phaseName}...`,
  );
}
