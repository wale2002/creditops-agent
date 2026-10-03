import { spawnSync } from "node:child_process";

const taskGroups = {
  test: [
    ["run", "test", "--workspace", "@creditops/domain"],
    ["run", "test", "--workspace", "@creditops/agent-tools"],
    ["run", "test", "--workspace", "@creditops/mcp-server"],
  ],
  "eval:policy": [
    ["run", "eval:policy", "--workspace", "@creditops/agent-tools"],
  ],
  build: [
    ["run", "build", "--workspace", "@creditops/domain"],
    ["run", "build", "--workspace", "@creditops/agent-tools"],
    ["run", "build", "--workspace", "@creditops/mcp-server"],
    ["run", "build", "--workspace", "web"],
  ],
  lint: [["run", "lint", "--workspace", "web"]],
};

taskGroups.ci = [
  ...taskGroups.test,
  ...taskGroups["eval:policy"],
  ...taskGroups.build,
  ...taskGroups.lint,
];

const requestedGroup = process.argv[2];
const tasks = taskGroups[requestedGroup];
const npmCli = process.env.npm_execpath;

if (!tasks) {
  console.error(`Unknown workspace task group: ${requestedGroup ?? "missing"}`);
  process.exit(1);
}

if (!npmCli) {
  console.error("npm_execpath is required to run workspace tasks");
  process.exit(1);
}

for (const argumentsList of tasks) {
  console.log(`\n> npm ${argumentsList.join(" ")}\n`);
  const result = spawnSync(process.execPath, [npmCli, ...argumentsList], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
