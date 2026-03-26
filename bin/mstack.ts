#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
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
  resolveRunInput,
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
  .command("run [task]")
  .description("Start a new workflow")
  .option(
    "--mode <mode>",
    "Override orchestration mode (prompt|code|interactive)",
  )
  .option("--config <path>", "Path to config file")
  .option("-f, --file <path>", "Path to a spec file whose contents will be used as the task prompt")
  .action(async (task: string | undefined, opts) => {
    try {
      const config = await loadConfig(opts.config);
      if (opts.mode) config.orchestration = opts.mode;

      let fileContent: string | undefined;
      let fileStem: string | undefined;
      if (opts.file) {
        fileContent = fs.readFileSync(opts.file, "utf8");
        fileStem = path.basename(opts.file, path.extname(opts.file));
      }

      const { title, userTask } = resolveRunInput({ task, fileContent, fileStem });

      const slug = generateSlug(title);
      const workflowDir = createWorkflowDir(config, slug);
      writeWorkflowRoot(workflowDir, config, userTask, title);

      console.log(`Workflow: ${slug}`);
      console.log(`Mode: ${config.orchestration}`);
      console.log(`Output: ${workflowDir}\n`);

      await run(config, userTask, workflowDir);
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
