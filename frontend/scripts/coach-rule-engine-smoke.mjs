import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(__dirname, "../src/services/coachRuleEngine.ts");
const exerciseLibraryPath = path.resolve(__dirname, "../src/data/exerciseLibrary.ts");
const exerciseMetadataPath = path.resolve(__dirname, "../src/data/exerciseMetadata.ts");

function compileModule(filePath) {
    const source = fs.readFileSync(filePath, "utf8");
    return ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
        },
    }).outputText;
}

const moduleCache = new Map();
function loadModule(filePath) {
    if (moduleCache.has(filePath)) return moduleCache.get(filePath).exports;
    const module = { exports: {} };
    moduleCache.set(filePath, module);
    const run = new Function("exports", "module", "require", compileModule(filePath));
    run(module.exports, module, (request) => {
        if (request === "../data/exerciseLibrary") return loadModule(exerciseLibraryPath);
        if (request === "../data/exerciseMetadata") return loadModule(exerciseMetadataPath);
        throw new Error(`coachRuleEngine smoke test should not require external module: ${request}`);
    });
    return module.exports;
}

const engine = loadModule(sourcePath);

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
assertEqual(backFocus, ["shoulder_adduction", "shoulder_extension", "horizontal_adduction"], "Back focus priority cluster");

const orderedFocus = engine.getTrainingDays({
    frequency: 4,
    split: "UL",
    priority: null,
    priorityOrder: ["shoulder_abduction", "horizontal_adduction", "elbow_extension"],
})[0].patterns.slice(0, 4);
assertEqual(orderedFocus, ["shoulder_abduction", "horizontal_adduction", "upper_chest", "elbow_extension"], "Ordered priority respects selected order and clusters");

const rearDeltPriority = engine.applyPrioritySelectionRules([], "rear_delt");
assertEqual(rearDeltPriority, ["rear_delt", "trapezius"], "Rear delt priority auto-pairs trapezius");

const trapeziusPriority = engine.applyPrioritySelectionRules([], "trapezius");
assertEqual(trapeziusPriority, ["trapezius", "rear_delt"], "Trapezius priority auto-pairs rear delt");

const chestOptions = engine.getAvailableExercises("horizontal_adduction", "Pec Deck").slice(0, 2);
assertEqual(chestOptions, ["Chest Press Machine", "Smith Machine Bench Press"], "Avoided exercise is removed from recommendations");

const chestOptionsAlias = engine.getAvailableExercises("horizontal_adduction", "pecdeck").slice(0, 2);
assertEqual(chestOptionsAlias, ["Chest Press Machine", "Smith Machine Bench Press"], "Avoided exercise alias is removed from recommendations");

const noSmithChestOptions = engine.getAvailableExercises("horizontal_adduction", "", [], {
    hasEquipmentLimit: "yes",
    equipmentLimitNote: "Smith machine yok",
}).slice(0, 2);
assertEqual(noSmithChestOptions, ["Pec Deck", "Chest Press Machine"], "Unavailable equipment is removed from recommendations");

const dumbbellOnlyChestOptions = engine.getAvailableExercises("horizontal_adduction", "", [], {
    hasEquipmentLimit: "yes",
    equipmentLimitNote: "Sadece dumbbell var",
});
assertEqual(dumbbellOnlyChestOptions.slice(0, 2), ["Dumbbell Press", "Dumbbell Fly"], "Only-equipment note prioritizes available dumbbell recommendations");
const blockedEquipmentRecommendations = ["Pec Deck", "Chest Press Machine", "Smith Machine Bench Press", "Cable Fly"];
assertEqual(
    blockedEquipmentRecommendations.filter((name) => dumbbellOnlyChestOptions.includes(name)),
    [],
    "Only-equipment note removes unavailable machine/cable/smith recommendations",
);

assertEqual(engine.COACH_PATTERN_LABELS.leg_press, "Vastuslar (ön bacak)", "Leg press target label");
assertEqual(engine.COACH_PATTERN_LABELS.hip_hinge, "Hinge", "Hip hinge target label");

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
assertEqual(generated.days[0].exercises[0].name, "Chest Press Machine", "Avoid note affects generated program");
assertEqual(generated.days[0].exercises[0].exerciseId, "chest_press_machine", "Generated program keeps canonical exercise id");

const fatLoss = engine.buildCoachProgramData({
    frequency: 3,
    split: "FB",
    level: "beginner",
    goal: "fat_loss",
    hasPain: "no",
});
assertEqual(fatLoss.days[0].exercises[0].targetSets[1].targetReps, "12-15", "Fat loss beginner uses higher 12-15 rep range when base is 8-12");

const strengthFocus = engine.buildCoachProgramData({
    frequency: 4,
    split: "UL",
    level: "intermediate",
    goal: "strength",
    strengthFocus: "powerlifting",
    hasPain: "no",
});
assertEqual(strengthFocus.days[0].exercises[0].targetSets[1].targetReps, "3-6", "Specific strength focus uses lower rep target");
assertEqual(strengthFocus.days[0].exercises[0].targetSets[1].targetRIR, "1-2", "Specific strength focus uses higher RIR target");

const kneePain = engine.buildCoachProgramData({
    frequency: 4,
    split: "UL",
    level: "intermediate",
    goal: "muscle",
    hasPain: "yes",
    painNote: "Sağ dizimde ağrı var",
    includePainArea: "no",
});
assertEqual(kneePain.days[1].exercises.some((exercise) => exercise.targetPattern === "leg_press"), false, "Pain-limited patterns can be excluded");

const kneeInjury = engine.buildCoachProgramData({
    frequency: 4,
    split: "UL",
    level: "intermediate",
    goal: "muscle",
    hasPain: "yes",
    painNote: "Sağ dizimde sakatlık var",
});
assertEqual(kneeInjury.days[1].exercises.some((exercise) => exercise.targetPattern === "knee_extension"), true, "Injury-limited patterns stay in the program");
assertEqual(kneeInjury.days[1].exercises.find((exercise) => exercise.targetPattern === "knee_extension")?.logDisabled, true, "Injury-limited patterns are not loggable");

console.log("coach-rule-engine smoke tests passed");
