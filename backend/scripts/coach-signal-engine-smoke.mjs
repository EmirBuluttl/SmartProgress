import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const enginePath = path.resolve("src/services/coachSignalEngine.ts");
const source = fs.readFileSync(enginePath, "utf8");
const transpiled = ts.transpileModule(source, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
    },
});

const sandbox = {
    exports: {},
    require,
    console,
};
vm.runInNewContext(transpiled.outputText, sandbox, { filename: enginePath });

const { compareExerciseHistory, normalizeRirValue, parseRepRange, resolveCoachSetLoad } = sandbox.exports;

function entry(index, best) {
    return {
        logId: `log-${index}`,
        logDate: new Date(Date.UTC(2026, 4, index)),
        name: "Wide Grip Pull Up",
        best,
    };
}

function history(bestSets) {
    return bestSets.map((best, index) => entry(index + 1, best));
}

function expectSignal(name, bestSets, expected) {
    const signal = compareExerciseHistory(history(bestSets));
    assert.equal(signal.decision, expected.decision, `${name}: decision`);
    for (const flag of expected.flags || []) {
        assert.ok(signal.flags.includes(flag), `${name}: missing flag ${flag}`);
    }
    for (const flag of expected.absentFlags || []) {
        assert.ok(!signal.flags.includes(flag), `${name}: unexpected flag ${flag}`);
    }
    if (expected.recommendationType) {
        assert.equal(signal.recommendation?.type, expected.recommendationType, `${name}: recommendation type`);
        assert.equal(signal.recommendation?.requiresUserApproval, true, `${name}: recommendation approval`);
    }
    if (expected.noRecommendation) {
        assert.equal(signal.recommendation, null, `${name}: recommendation should be empty`);
    }
}

function runScenarioMatrix(scenarios) {
    for (const scenario of scenarios) {
        expectSignal(scenario.name, scenario.bestSets, scenario.expected);
    }
    console.log(`Coach scenario matrix passed (${scenarios.length} scenarios)`);
}

function expectJsonEqual(actual, expected, message) {
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), message);
}

assert.equal(normalizeRirValue("1-2"), 1.5, "RIR range should normalize by average");
assert.equal(normalizeRirValue("2,5"), 2.5, "Comma decimal RIR should parse");
assert.equal(JSON.stringify(parseRepRange("4-8")), JSON.stringify({ min: 4, max: 8 }), "Rep range should parse");
assert.equal(JSON.stringify(parseRepRange("12")), JSON.stringify({ min: 12, max: 12 }), "Single rep target should parse");
expectJsonEqual(resolveCoachSetLoad({ weight: 100, weightMode: "kg" }), {
    weight: 100,
    weightMode: "kg",
    bodyWeight: null,
    externalWeight: null,
}, "KG sets should keep logged load");
expectJsonEqual(resolveCoachSetLoad({ weight: 82, weightMode: "bodyweight" }), {
    weight: 82,
    weightMode: "bodyweight",
    bodyWeight: 82,
    externalWeight: null,
}, "Bodyweight sets should use bodyweight from weight fallback");
expectJsonEqual(resolveCoachSetLoad({ weightMode: "bodyweight", bodyWeight: 82, externalWeight: 12.5 }), {
    weight: 94.5,
    weightMode: "bodyweight",
    bodyWeight: 82,
    externalWeight: 12.5,
}, "Weighted bodyweight sets should compare BW plus external load");

runScenarioMatrix([
    {
        name: "baseline first log",
        bestSets: [{ weight: 80, reps: 4, rir: "1-2" }],
        expected: { decision: "baseline", flags: ["baseline"] },
    },
    {
        name: "same weight reps progress",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 80, reps: 9, rir: 2 },
        ],
        expected: { decision: "progress" },
    },
    {
        name: "weight progress",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 82.5, reps: 8, rir: 2 },
        ],
        expected: { decision: "progress" },
    },
    {
        name: "weight progress beats small rep drop",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 82.5, reps: 7, rir: 2 },
        ],
        expected: { decision: "progress", absentFlags: ["single_session_regression"] },
    },
    {
        name: "weighted bodyweight progress",
        bestSets: [
            { ...resolveCoachSetLoad({ weightMode: "bodyweight", bodyWeight: 82, externalWeight: 0 }), reps: 6, rir: "1-2" },
            { ...resolveCoachSetLoad({ weightMode: "bodyweight", bodyWeight: 82, externalWeight: 5 }), reps: 6, rir: "1-2" },
        ],
        expected: { decision: "progress" },
    },
    {
        name: "upper rep target reached",
        bestSets: [
            { weight: 80, reps: 7, rir: "1-2", targetReps: "4-8" },
            { weight: 80, reps: 8, rir: "1-2", targetReps: "4-8" },
        ],
        expected: {
            decision: "progress",
            flags: ["upper_rep_target_reached", "weight_increase_candidate"],
            recommendationType: "increase_weight",
        },
    },
    {
        name: "below upper rep target no weight increase",
        bestSets: [
            { weight: 80, reps: 6, rir: "1-2", targetReps: "4-8" },
            { weight: 80, reps: 7, rir: "1-2", targetReps: "4-8" },
        ],
        expected: { decision: "progress", absentFlags: ["upper_rep_target_reached", "weight_increase_candidate"] },
    },
    {
        name: "single session reps regression",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 80, reps: 7, rir: 2 },
        ],
        expected: { decision: "watch", flags: ["single_session_regression"] },
    },
    {
        name: "single session weight regression",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 77.5, reps: 8, rir: 2 },
        ],
        expected: { decision: "watch", flags: ["single_session_regression"] },
    },
    {
        name: "lower weight with more reps is still watch",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 77.5, reps: 10, rir: 2 },
        ],
        expected: { decision: "watch", flags: ["single_session_regression"] },
    },
    {
        name: "plateau with low rir",
        bestSets: [
            { weight: 80, reps: 8, rir: 1 },
            { weight: 80, reps: 8, rir: 1 },
            { weight: 80, reps: 8, rir: 1 },
        ],
        expected: {
            decision: "watch",
            flags: ["plateau_candidate", "low_rir", "rir_adjustment_candidate"],
            absentFlags: ["volume_reduce_candidate"],
            recommendationType: "relax_rir",
        },
    },
    {
        name: "plateau with rir range one to two",
        bestSets: [
            { weight: 80, reps: 8, rir: "1-2" },
            { weight: 80, reps: 8, rir: "1-2" },
            { weight: 80, reps: 8, rir: "1-2" },
        ],
        expected: {
            decision: "watch",
            flags: ["plateau_candidate", "low_rir", "rir_adjustment_candidate"],
            absentFlags: ["volume_reduce_candidate"],
            recommendationType: "relax_rir",
        },
    },
    {
        name: "plateau with relaxed rir",
        bestSets: [
            { weight: 80, reps: 8, rir: 3 },
            { weight: 80, reps: 8, rir: 3 },
            { weight: 80, reps: 8, rir: 3 },
        ],
        expected: {
            decision: "watch",
            flags: ["plateau_candidate", "volume_reduce_candidate"],
            absentFlags: ["low_rir", "rir_adjustment_candidate"],
            recommendationType: "reduce_volume",
        },
    },
    {
        name: "strong progress streak volume increase",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 80, reps: 9, rir: 2 },
            { weight: 80, reps: 11, rir: 2 },
        ],
        expected: {
            decision: "progress",
            flags: ["progress_streak", "volume_increase_candidate"],
            recommendationType: "increase_volume",
        },
    },
    {
        name: "small progress streak no volume increase",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 80, reps: 9, rir: 2 },
            { weight: 80, reps: 10, rir: 2 },
        ],
        expected: { decision: "progress", absentFlags: ["volume_increase_candidate"] },
    },
    {
        name: "progress then one stall is not plateau yet",
        bestSets: [
            { weight: 80, reps: 8, rir: 2 },
            { weight: 80, reps: 9, rir: 2 },
            { weight: 80, reps: 9, rir: 2 },
        ],
        expected: {
            decision: "watch",
            flags: ["same_as_previous"],
            absentFlags: ["plateau_candidate", "volume_reduce_candidate", "rir_adjustment_candidate"],
            noRecommendation: true,
        },
    },
]);

console.log("Coach signal smoke scenarios passed");
