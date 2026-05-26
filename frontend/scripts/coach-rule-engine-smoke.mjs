import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, "../src/services/coachRuleEngine.ts");
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
    throw new Error("coachRuleEngine smoke test should not require external modules");
});

const engine = module.exports;

function assertEqual(actual, expected, label) {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
        throw new Error(`${label}\nExpected: ${expectedText}\nActual:   ${actualText}`);
    }
}

const ap4 = engine.getWorkoutDays({ frequency: 4, split: "AP", priority: null }).map((day) => day.label);
assertEqual(ap4, ["Anterior A", "Posterior A", "Dinlenme", "Anterior B", "Posterior B", "Dinlenme"], "AP 4 day cycle");

const ul4 = engine.getWorkoutDays({ frequency: 4, split: "UL", priority: null }).map((day) => day.label);
assertEqual(ul4, ["Upper A", "Lower A", "Dinlenme", "Upper B", "Lower B", "Dinlenme"], "UL 4 day cycle");

const backFocus = engine.getTrainingDays({ frequency: 4, split: "UL", priority: "shoulder_adduction" })[0].patterns.slice(0, 3);
assertEqual(backFocus, ["shoulder_adduction", "shoulder_extension", "upper_back"], "Back focus priority cluster");

const chestOptions = engine.getAvailableExercises("horizontal_adduction", "Pec Deck").slice(0, 2);
assertEqual(chestOptions, ["Smith Machine Bench Press", "Chest Press Machine"], "Avoided exercise is removed from recommendations");

assertEqual(engine.COACH_PATTERN_LABELS.leg_press, "Vastuslar (ön bacak)", "Leg press target label");
assertEqual(engine.COACH_PATTERN_LABELS.hip_hinge, "Hamstring/Glute", "Hip hinge target label");

const generated = engine.buildCoachProgramData({
    frequency: 4,
    split: "AP",
    level: "intermediate",
    goal: "muscle",
    hasPain: "no",
    priority: null,
    avoidNote: "Pec Deck",
});
assertEqual(generated.days.map((day) => day.isRestDay || false), [false, false, true, false, false, true], "Generated rest days");
assertEqual(generated.days[0].exercises[0].name, "Smith Machine Bench Press", "Avoid note affects generated program");

console.log("coach-rule-engine smoke tests passed");
