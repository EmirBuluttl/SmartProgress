import test from "node:test";
import assert from "node:assert/strict";

const { WorkoutService } = await import("../dist/services/workout.service.js");
const {
    compareBestSets,
    compareExerciseHistory,
    resolveCoachSetLoad,
} = await import("../dist/services/coachSignalEngine.js");

test("workout sync validation preserves RIR 0, decimal kg, and unilateral side data", () => {
    const service = new WorkoutService();
    const input = service.validateSyncInput({
        workouts: [
            {
                sportId: "11111111-1111-4111-8111-111111111111",
                title: "Smoke workout",
                notes: null,
                logDate: "2026-07-23T10:00:00.000Z",
                data: {
                    programId: "22222222-2222-4222-8222-222222222222",
                    dayIndex: 0,
                    exercises: [
                        {
                            name: "Single Arm Cable Curl",
                            sets: [
                                {
                                    reps: "12",
                                    weight: "0.5",
                                    rpe: 8,
                                    rir: 0,
                                    sideMode: "left_right",
                                    left: { weight: "2.5", reps: "12", rir: 0 },
                                    right: { weight: "3.5", reps: "11", rir: 1 },
                                },
                            ],
                        },
                    ],
                },
            },
        ],
    });

    const set = input.workouts[0].data.exercises?.[0]?.sets[0];
    assert.equal(set?.weight, 0.5);
    assert.equal(set?.rir, 0);
    assert.equal(set?.left?.weight, 2.5);
    assert.equal(set?.left?.rir, 0);
    assert.equal(set?.right?.weight, 3.5);
});

test("workout sync validation rejects empty sync batches", () => {
    const service = new WorkoutService();
    assert.throws(
        () => service.validateSyncInput({ workouts: [] }),
        /Workout sync validation failed/,
    );
});

test("coach signal engine keeps bodyweight-only and added-weight streams separate", () => {
    const previous = resolveCoachSetLoad({
        weightMode: "bodyweight",
        bodyWeight: 75,
        externalWeight: 50,
        reps: 10,
    });
    const current = resolveCoachSetLoad({
        weightMode: "bodyweight",
        bodyWeight: 75,
        reps: 20,
    });

    const comparison = compareBestSets(
        { ...previous, reps: 10, rir: 1, targetReps: "8-12" },
        { ...current, reps: 20, rir: 1, targetReps: "8-12" },
    );

    assert.equal(comparison.decision, "watch");
    assert.match(comparison.reason, /ayri takip/i);
});

test("coach signal engine does not mark load drop plus enough rep gain as regression", () => {
    const signal = compareExerciseHistory([
        {
            logId: "a",
            logDate: new Date("2026-07-01T10:00:00.000Z"),
            name: "Adductor Machine",
            best: { weight: 56, reps: 6, rir: 1, targetReps: "8-12" },
        },
        {
            logId: "b",
            logDate: new Date("2026-07-08T10:00:00.000Z"),
            name: "Adductor Machine",
            best: { weight: 49, reps: 12, rir: 1, targetReps: "8-12" },
        },
    ]);

    assert.notEqual(signal.decision, "regression");
    assert.equal(signal.flags.includes("single_session_regression"), false);
});
