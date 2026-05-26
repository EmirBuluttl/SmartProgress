import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, "../src/services/progressRuleEngine.ts");
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
    throw new Error("progressRuleEngine smoke test should not require external modules");
});

const engine = module.exports;

function assertEqual(actual, expected, label) {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
        throw new Error(`${label}\nExpected: ${expectedText}\nActual:   ${actualText}`);
    }
}

const pullUpProgress = engine.analyzeProgress({
    exerciseName: "Wide Grip Pull Up",
    repRange: { min: 4, max: 8 },
    workingSetCount: 1,
    loadType: "external_load",
    logs: [
        { weight: 80, reps: 4, rir: "1-2" },
        { weight: 80, reps: 4, rir: "1-2" },
        { weight: 80, reps: 5, rir: "1" },
    ],
});
assertEqual(pullUpProgress.decision, "continue_same_weight", "Wide Grip Pull Up latest rep progress");
assertEqual(pullUpProgress.nextTarget, { weight: 80, reps: 6 }, "Wide Grip Pull Up next target");

const benchTopRange = engine.analyzeProgress({
    exerciseName: "Bench Press",
    repRange: { min: 8, max: 12 },
    workingSetCount: 1,
    loadType: "external_load",
    minimumLoadIncrement: 2.5,
    logs: [
        { weight: 80, reps: 10, rir: 1 },
        { weight: 80, reps: 11, rir: 1 },
        { weight: 80, reps: 12, rir: 1 },
    ],
});
assertEqual(benchTopRange.decision, "increase_weight", "Bench reaches top of range");
assertEqual(benchTopRange.nextTarget, { weight: 82.5, reps: 8, loadDirection: "increase" }, "Bench increase target");

const lowRirPlateau = engine.analyzeProgress({
    exerciseName: "Chest Press Machine",
    repRange: { min: 4, max: 8 },
    workingSetCount: 1,
    loadType: "external_load",
    logs: [
        { weight: 100, reps: 6, rir: "0-1" },
        { weight: 100, reps: 6, rir: "0-1" },
        { weight: 100, reps: 6, rir: "0-1" },
    ],
});
assertEqual(lowRirPlateau.decision, "raise_rir", "Low RIR plateau should raise RIR first");

const assistedProgress = engine.analyzeProgress({
    exerciseName: "Assisted Pull Up",
    repRange: { min: 4, max: 8 },
    workingSetCount: 1,
    loadType: "assisted_load",
    minimumLoadIncrement: 5,
    logs: [
        { weight: 60, reps: 5, rir: 2 },
        { weight: 55, reps: 5, rir: 2 },
    ],
});
assertEqual(assistedProgress.decision, "continue_same_weight", "Assisted load decrease counts as progress");

const inconsistent = engine.analyzeProgress({
    exerciseName: "Leg Press",
    repRange: { min: 8, max: 12 },
    workingSetCount: 1,
    logs: [
        { weight: 180, reps: 10 },
        { weight: null, reps: 11 },
    ],
});
assertEqual(inconsistent.decision, "inconsistent_data", "Missing load should be inconsistent");

console.log("progress-rule-engine smoke tests passed");
