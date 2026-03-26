/**
 * PermissionError — thrown when the SDK agent encounters a permission denial.
 *
 * The mstack runner catches this error and immediately stops the workflow,
 * marking the workflow status as "permission-error" so the human can
 * intervene (e.g., add missing permissions to .claude/settings.local.json).
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Patterns that indicate a permission denial in agent output.
 * Kept in a single place so it's easy to adjust if SDK wording changes.
 */
const PERMISSION_PATTERNS = [
  /this command requires approval/i,
  /permission denied/i,
  /does not have permission/i,
  /tool use was not approved/i,
  /has not been granted permission/i,
];

/**
 * Returns true if the given text contains a recognisable permission-denial
 * message. Used to detect silent permission failures in the final agent result.
 */
export function isPermissionError(text: string): boolean {
  return PERMISSION_PATTERNS.some((pattern) => pattern.test(text));
}
