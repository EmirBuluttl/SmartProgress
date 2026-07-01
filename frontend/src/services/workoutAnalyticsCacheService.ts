import { groupForExerciseName } from "../data/exerciseTaxonomy";
import { getWorkoutCacheVersion } from "./workoutCacheService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    buildWeeklySnapshot,
    countProgressEvents,
    getPersonalRecords,
    getWorkoutExercises,
    normalizeExerciseName,
    type ExerciseSnapshot,
    type PersonalRecord,
} from "../utils/workoutMetrics";

const WORKOUT_ANALYTICS_STORAGE_KEY = "workout_analytics_snapshot_v2";

export type WorkoutAnalyticsSnapshot = {
    personalRecords: PersonalRecord[];
    progressEvents: number;
    weeklySnapshot: ExerciseSnapshot[];
    exerciseCounts: { key: string; original: string; count: number }[];
    muscleGroups: string[];
};

let cachedVersionRef: number | null = null;
let cachedSnapshot: WorkoutAnalyticsSnapshot | null = null;
let cachedFingerprintRef: string | null = null;

export function invalidateWorkoutAnalyticsCache() {
    cachedVersionRef = null;
    cachedFingerprintRef = null;
    cachedSnapshot = null;
    AsyncStorage.removeItem(WORKOUT_ANALYTICS_STORAGE_KEY).catch(() => undefined);
}

function buildFingerprint(workouts: any[]): string {
    if (!workouts.length) return "empty";
    const newest = workouts[0];
    const oldest = workouts[workouts.length - 1];
    return [
        workouts.length,
        newest?.id || "",
        newest?.updatedAt || newest?.logDate || "",
        oldest?.id || "",
        oldest?.updatedAt || oldest?.logDate || "",
    ].join("|");
}

async function savePersistedSnapshot(snapshot: WorkoutAnalyticsSnapshot, fingerprint: string) {
    try {
        await AsyncStorage.setItem(
            WORKOUT_ANALYTICS_STORAGE_KEY,
            JSON.stringify({ snapshot, fingerprint, savedAt: Date.now() }),
        );
    } catch (error) {
        console.warn("[workoutAnalyticsCacheService] Persist failed:", error);
    }
}

export async function getPersistedWorkoutAnalyticsSnapshot(): Promise<WorkoutAnalyticsSnapshot | null> {
    if (cachedSnapshot) return cachedSnapshot;
    try {
        const stored = await AsyncStorage.getItem(WORKOUT_ANALYTICS_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        if (!parsed?.snapshot) return null;
        cachedSnapshot = parsed.snapshot;
        cachedFingerprintRef = parsed.fingerprint || null;
        return cachedSnapshot;
    } catch (error) {
        console.warn("[workoutAnalyticsCacheService] Persist load failed:", error);
        return null;
    }
}

export function getWorkoutAnalyticsSnapshot(workouts: any[]): WorkoutAnalyticsSnapshot {
    const currentVersion = getWorkoutCacheVersion();
    const fingerprint = buildFingerprint(workouts);
    if (
        cachedVersionRef === currentVersion &&
        cachedFingerprintRef === fingerprint &&
        cachedSnapshot
    ) {
        return cachedSnapshot;
    }

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

    cachedVersionRef = currentVersion;
    cachedFingerprintRef = fingerprint;
    cachedSnapshot = snapshot;
    savePersistedSnapshot(snapshot, fingerprint).catch(() => undefined);
    return snapshot;
}
