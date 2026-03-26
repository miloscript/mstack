#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "../src/config.js";
import { scaffold } from "../src/scaffold.js";
import { run } from "../src/runner.js";
import { resume } from "../src/resume.js";
import { printStatus } from "../src/status.js";
import { createSkill } from "../src/skill-builder.js";
import {
  generateSlug,
  createWorkflowDir,
  writeWorkflowRoot,
} from "../src/utils/workflow-manager.js";

const program = new Command();

program
  .name("mstack")
  .description("Config-driven agentic dev workflow CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold .mstack/ directory with default config and skills")
  .option(
    "--force",
    "Overwrite existing scaffold (preserves knowledge/ and workflows/)",
  )
  .action(async (opts) => {
    try {
      await scaffold({ force: opts.force });
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program
  .command("run <task>")
  .description("Start a new workflow")
  .option(
    "--mode <mode>",
    "Override orchestration mode (prompt|code|interactive)",
  )
  .option("--config <path>", "Path to config file")
  .action(async (task, opts) => {
    try {
      const config = await loadConfig(opts.config);
      if (opts.mode) config.orchestration = opts.mode;

      const slug = generateSlug(task);
      const workflowDir = createWorkflowDir(config, slug);
      writeWorkflowRoot(workflowDir, config, task);

      console.log(`Workflow: ${slug}`);
      console.log(`Mode: ${config.orchestration}`);
      console.log(`Output: ${workflowDir}\n`);

      await run(config, task, workflowDir);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program
  .command("resume <workflow>")
  .description("Resume an interrupted workflow")
  .option("--mode <mode>", "Override orchestration mode")
  .action(async (workflow, opts) => {
    try {
      const config = await loadConfig();
      if (opts.mode) config.orchestration = opts.mode;
      await resume(config, workflow);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program
  .command("status [workflow]")
  .description("Show workflow status")
  .action(async (workflow) => {
    try {
      const config = await loadConfig();
      await printStatus(config, workflow);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program
  .command("create-skill <name>")
  .description("Scaffold a new custom skill file")
  .action(async (name) => {
    try {
      const config = await loadConfig();
      await createSkill(config, name);
    } catch (err) {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    }
  });

program.parse();
