import { describe, it, expect } from "vitest";
import {
  PermissionError,
  isPermissionError,
} from "../src/utils/permission-error.js";

describe("PermissionError", () => {
  it("is an instance of Error", () => {
    const err = new PermissionError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PermissionError);
  });

  it("has correct name property", () => {
    const err = new PermissionError("test message");
    expect(err.name).toBe("PermissionError");
    expect(err.message).toBe("test message");
  });
});

describe("isPermissionError", () => {
  it("detects 'This command requires approval' message", () => {
    expect(
      isPermissionError(
        "I tried to run the command but got: This command requires approval",
      ),
    ).toBe(true);
  });

  it("detects 'Permission denied' message", () => {
    expect(isPermissionError("Error: Permission denied")).toBe(true);
  });

  it("detects 'does not have permission' message", () => {
    expect(
      isPermissionError(
        "User does not have permission to run this tool",
      ),
    ).toBe(true);
  });

  it("detects 'tool use was not approved' message", () => {
    expect(
      isPermissionError(
        "The tool use was not approved by the user",
      ),
    ).toBe(true);
  });

  it("detects 'has not been granted permission' message", () => {
    expect(
      isPermissionError(
        "This operation has not been granted permission",
      ),
    ).toBe(true);
  });

  it("returns false for normal output", () => {
    expect(isPermissionError("The analysis is complete.")).toBe(false);
    expect(isPermissionError("Mock agent output for testing.")).toBe(false);
    expect(isPermissionError("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isPermissionError("permission denied")).toBe(true);
    expect(isPermissionError("PERMISSION DENIED")).toBe(true);
  });
});
