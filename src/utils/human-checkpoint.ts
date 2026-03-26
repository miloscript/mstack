import * as readline from "node:readline";

export async function humanCheckpoint(
  type: "pre" | "post",
  phaseName: string,
  context: string,
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Allow CTRL+C to exit cleanly during an interactive checkpoint
  rl.on("SIGINT", () => {
    rl.close();
    console.log("\n\nExiting mstack (interrupted by user).");
    process.exit(0);
  });

  const prompt =
    type === "pre"
      ? `\n📋 [${phaseName}] About to start. ${context}\n\nProceed? (Enter to continue, or type feedback): `
      : `\n✅ [${phaseName}] Complete. ${context}\n\nContinue? (Enter to continue, or type feedback): `;

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || "approved");
    });
  });
}
