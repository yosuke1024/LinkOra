import { parseArgs } from "node:util";
import { assertPeriod, previousMonth } from "./period.js";
import { createStorage } from "./storage/r2.js";
import { runFetch } from "./pipeline/fetch.js";
import { runNormalize } from "./pipeline/normalize.js";
import { runScore } from "./pipeline/score.js";
import { runExport } from "./pipeline/export.js";

const USAGE = `linkora — cross-border interest & information-gap pipeline

Usage:
  linkora <command> [--period YYYY-MM]

Commands:
  fetch      Stage 1: fetch raw data from enabled providers
  normalize  Stage 2: normalize raw data into signal records
  score      Stage 3: aggregate signal records into edge records
  export     Stage 4: publish edges.json / edges.csv to the exports layer
  run        All stages in order

Options:
  --period   Observation month (default: previous full month)
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      period: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  const command = positionals[0];
  if (values.help || command === undefined) {
    console.log(USAGE);
    process.exitCode = command === undefined && !values.help ? 1 : 0;
    return;
  }

  const period = values.period !== undefined ? assertPeriod(values.period) : previousMonth();
  const storage = createStorage();
  console.log(`linkora ${command} — period ${period}`);

  switch (command) {
    case "fetch":
      await runFetch(period, storage);
      break;
    case "normalize":
      await runNormalize(period, storage);
      break;
    case "score":
      await runScore(period, storage);
      break;
    case "export":
      await runExport(period, storage);
      break;
    case "run":
      await runFetch(period, storage);
      await runNormalize(period, storage);
      await runScore(period, storage);
      await runExport(period, storage);
      break;
    default:
      console.error(`Unknown command "${command}"\n\n${USAGE}`);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
