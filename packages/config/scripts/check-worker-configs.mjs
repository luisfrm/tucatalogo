#!/usr/bin/env node
import { checkAllWorkerConfigs } from "./worker-config.mjs";

const results = checkAllWorkerConfigs();
let failed = false;

for (const { app, errors } of results) {
  if (errors.length === 0) {
    console.log(`A1 OK  ${app}`);
    continue;
  }

  failed = true;
  console.error(`A1 FAIL ${app}`);
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
}

if (failed) {
  console.error(
    "\nRevisa apps/*/wrangler.jsonc: A1 exige workers_dev/preview_urls y api sin routes.",
  );
  process.exitCode = 1;
}
