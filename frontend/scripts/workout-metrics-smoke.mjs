import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, "../src/utils/workoutMetrics.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
    },
});

const module = { exports: {} };
const run = new Function("exports", "module", "require", compiled.outputText);
run(module.exports, module, () => {
    throw new Error("workoutMetrics smoke test should not require external modules");
});

const metrics = module.exports;

function assertEqual(actual, expected, label) {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
        throw new Error(`${label}\nExpected: ${expectedText}\nActual:   ${actualText}`);
    }
}

const base = { exercise: "Bench Press", weight: 100, reps: 8, unit: "kg" };

assertEqual(
    metrics.calculateSetProgressScore(base, { ...base, weight: 105 }),
    5,
    "100x8 -> 105x8 should be +5%",
);

assertEqual(
    metrics.calculateSetProgressScore(base, { ...base, reps: 9 }),
    2,
    "100x8 -> 100x9 should be +2%",
);

assertEqual(
    metrics.calculateSetProgressScore(base, { ...base, reps: 11 }),
    7,
    "100x8 -> 100x11 should be +7%",
);

assertEqual(
    metrics.calculateSetProgressScore({ ...base, reps: 10 }, { ...base, reps: 8 }),
    -5,
    "100x10 -> 100x8 should be -5%",
);

console.log("workout-metrics smoke tests passed");
