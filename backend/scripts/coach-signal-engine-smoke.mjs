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

expectSignal("baseline first log", [
    { weight: 80, reps: 4, rir: "1-2" },
], {
    decision: "baseline",
    flags: ["baseline"],
});

expectSignal("same weight reps progress", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 80, reps: 9, rir: 2 },
], {
    decision: "progress",
});

expectSignal("weight progress", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 82.5, reps: 8, rir: 2 },
], {
    decision: "progress",
});

expectSignal("upper rep target reached", [
    { weight: 80, reps: 7, rir: "1-2", targetReps: "4-8" },
    { weight: 80, reps: 8, rir: "1-2", targetReps: "4-8" },
], {
    decision: "progress",
    flags: ["upper_rep_target_reached", "weight_increase_candidate"],
});

expectSignal("below upper rep target no weight increase", [
    { weight: 80, reps: 6, rir: "1-2", targetReps: "4-8" },
    { weight: 80, reps: 7, rir: "1-2", targetReps: "4-8" },
], {
    decision: "progress",
    absentFlags: ["upper_rep_target_reached", "weight_increase_candidate"],
});

expectSignal("single session reps regression", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 80, reps: 7, rir: 2 },
], {
    decision: "watch",
    flags: ["single_session_regression"],
});

expectSignal("single session weight regression", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 77.5, reps: 8, rir: 2 },
], {
    decision: "watch",
    flags: ["single_session_regression"],
});

expectSignal("plateau with low rir", [
    { weight: 80, reps: 8, rir: 1 },
    { weight: 80, reps: 8, rir: 1 },
    { weight: 80, reps: 8, rir: 1 },
], {
    decision: "watch",
    flags: ["plateau_candidate", "low_rir", "rir_adjustment_candidate"],
    absentFlags: ["volume_reduce_candidate"],
});

expectSignal("plateau with rir range one to two", [
    { weight: 80, reps: 8, rir: "1-2" },
    { weight: 80, reps: 8, rir: "1-2" },
    { weight: 80, reps: 8, rir: "1-2" },
], {
    decision: "watch",
    flags: ["plateau_candidate", "low_rir", "rir_adjustment_candidate"],
    absentFlags: ["volume_reduce_candidate"],
});

expectSignal("plateau with relaxed rir", [
    { weight: 80, reps: 8, rir: 3 },
    { weight: 80, reps: 8, rir: 3 },
    { weight: 80, reps: 8, rir: 3 },
], {
    decision: "watch",
    flags: ["plateau_candidate", "volume_reduce_candidate"],
    absentFlags: ["low_rir", "rir_adjustment_candidate"],
});

expectSignal("strong progress streak volume increase", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 80, reps: 9, rir: 2 },
    { weight: 80, reps: 11, rir: 2 },
], {
    decision: "progress",
    flags: ["progress_streak", "volume_increase_candidate"],
});

expectSignal("small progress streak no volume increase", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 80, reps: 9, rir: 2 },
    { weight: 80, reps: 10, rir: 2 },
], {
    decision: "progress",
    absentFlags: ["volume_increase_candidate"],
});

expectSignal("progress then one stall is not plateau yet", [
    { weight: 80, reps: 8, rir: 2 },
    { weight: 80, reps: 9, rir: 2 },
    { weight: 80, reps: 9, rir: 2 },
], {
    decision: "watch",
    flags: ["same_as_previous"],
    absentFlags: ["plateau_candidate", "volume_reduce_candidate", "rir_adjustment_candidate"],
});

console.log("Coach signal smoke scenarios passed");
