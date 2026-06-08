import { groupForExerciseName } from "../data/exerciseTaxonomy";
import {
    buildWeeklySnapshot,
    countProgressEvents,
    getPersonalRecords,
    getWorkoutExercises,
    normalizeExerciseName,
    type ExerciseSnapshot,
    type PersonalRecord,
} from "../utils/workoutMetrics";

export type WorkoutAnalyticsSnapshot = {
    personalRecords: PersonalRecord[];
    progressEvents: number;
    weeklySnapshot: ExerciseSnapshot[];
    exerciseCounts: { key: string; original: string; count: number }[];
    muscleGroups: string[];
};

let cachedWorkoutsRef: any[] | null = null;
let cachedSnapshot: WorkoutAnalyticsSnapshot | null = null;

export function invalidateWorkoutAnalyticsCache() {
    cachedWorkoutsRef = null;
    cachedSnapshot = null;
}

export function getWorkoutAnalyticsSnapshot(workouts: any[]): WorkoutAnalyticsSnapshot {
    if (cachedWorkoutsRef === workouts && cachedSnapshot) return cachedSnapshot;

    const personalRecords = getPersonalRecords(workouts);
    const exerciseCountMap = new Map<string, { key: string; original: string; count: number }>();

    for (const workout of workouts) {
        for (const exercise of getWorkoutExercises(workout)) {
            if (!exercise.name) continue;
            const key = normalizeExerciseName(exercise.name);
            const existing = exerciseCountMap.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                exerciseCountMap.set(key, {
                    key,
                    original: String(exercise.name),
                    count: 1,
                });
            }
        }
    }

    const snapshot: WorkoutAnalyticsSnapshot = {
        personalRecords,
        progressEvents: countProgressEvents(workouts),
        weeklySnapshot: buildWeeklySnapshot(workouts),
        exerciseCounts: Array.from(exerciseCountMap.values()).sort((a, b) => b.count - a.count),
        muscleGroups: Array.from(
            new Set(personalRecords.map((pr) => groupForExerciseName(pr.exercise)?.beginnerLabel || "Genel")),
        ),
    };

    cachedWorkoutsRef = workouts;
    cachedSnapshot = snapshot;
    return snapshot;
}
