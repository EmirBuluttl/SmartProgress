type AnySet = {
    weight?: number | string;
    reps?: number | string;
    rpe?: number | string | null;
    rir?: number | string | null;
    unit?: "kg" | "lbs" | string;
    isWarmup?: boolean;
};

type AnyExercise = {
    name?: string;
    sets?: AnySet[];
};

type AnyWorkout = {
    logDate?: string;
    data?: {
        exercises?: AnyExercise[];
        totalVolume?: number;
    };
};

export interface PersonalRecord {
    exercise: string;
    weight: number;
    reps: number;
    unit: string;
    date?: string;
}

export interface ProgressPoint {
    date?: string;
    improved: number;
    comparable: number;
    percentage: number;
}

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function clampRpe(value: unknown): number {
    return Math.min(10, Math.max(0, toNumber(value)));
}

export function clampRir(value: unknown, reps: unknown): number | undefined {
    if (value === null || value === undefined || value === "") return undefined;
    const raw = String(value).trim();
    if (!raw) return undefined;
    const numeric = toNumber(raw);
    const maxReps = Math.max(0, Math.floor(toNumber(reps)));
    return Math.min(maxReps, Math.max(0, numeric));
}

export function getWorkoutExercises(workout: AnyWorkout): AnyExercise[] {
    return Array.isArray(workout?.data?.exercises) ? workout.data!.exercises! : [];
}

function isWorkingSet(set: AnySet): boolean {
    return !set.isWarmup;
}

function hasLoggedSetData(set: AnySet): boolean {
    return toNumber(set.weight) > 0 || toNumber(set.reps) > 0 || toNumber(set.rpe) > 0;
}

export function calculateLoadScoreFromExercises(exercises: AnyExercise[] = []): number {
    const score = exercises.reduce((total, exercise) => {
        const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
        return total + sets.reduce((setTotal, set) => {
            if (!isWorkingSet(set) || !hasLoggedSetData(set)) return setTotal;
            const rpe = clampRpe(set.rpe);
            return setTotal + (rpe > 0 ? rpe / 10 : 1);
        }, 0);
    }, 0);

    return Math.round(score * 10) / 10;
}

export function calculateWorkoutLoadScore(workout: AnyWorkout): number {
    return calculateLoadScoreFromExercises(getWorkoutExercises(workout));
}

function normalizeExerciseName(name: unknown): string {
    return String(name || "").trim().toLowerCase();
}

function getBestSet(exercise: AnyExercise): PersonalRecord | null {
    const name = String(exercise.name || "").trim();
    if (!name) return null;

    const best = (exercise.sets || [])
        .filter((set) => !set.isWarmup)
        .map((set) => ({
            exercise: name,
            weight: toNumber(set.weight),
            reps: Math.floor(toNumber(set.reps)),
            unit: set.unit || "kg",
        }))
        .filter((set) => set.weight > 0 || set.reps > 0)
        .sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0];

    return best || null;
}

function beatsRecord(next: PersonalRecord, previous?: PersonalRecord): boolean {
    if (!previous) return true;
    if (next.weight > previous.weight) return true;
    return next.weight === previous.weight && next.reps > previous.reps;
}

export function getPersonalRecords(workouts: AnyWorkout[]): PersonalRecord[] {
    const records = new Map<string, PersonalRecord>();

    workouts.forEach((workout) => {
        getWorkoutExercises(workout).forEach((exercise) => {
            const best = getBestSet(exercise);
            if (!best) return;
            const key = normalizeExerciseName(best.exercise);
            const current = records.get(key);
            if (beatsRecord(best, current)) {
                records.set(key, { ...best, date: workout.logDate });
            }
        });
    });

    return Array.from(records.values()).sort((a, b) => b.weight - a.weight || b.reps - a.reps);
}

export function countProgressEvents(workouts: AnyWorkout[]): number {
    const chronological = [...workouts].sort(
        (a, b) => new Date(a.logDate || 0).getTime() - new Date(b.logDate || 0).getTime(),
    );
    const bestByExercise = new Map<string, PersonalRecord>();
    let count = 0;

    chronological.forEach((workout) => {
        getWorkoutExercises(workout).forEach((exercise) => {
            const best = getBestSet(exercise);
            if (!best) return;

            const key = normalizeExerciseName(best.exercise);
            const previousBest = bestByExercise.get(key);
            if (previousBest && beatsRecord(best, previousBest)) {
                count += 1;
            }
            if (beatsRecord(best, previousBest)) {
                bestByExercise.set(key, { ...best, date: workout.logDate });
            }
        });
    });

    return count;
}

export function buildProgressTrend(workouts: AnyWorkout[]): ProgressPoint[] {
    const chronological = [...workouts].sort(
        (a, b) => new Date(a.logDate || 0).getTime() - new Date(b.logDate || 0).getTime(),
    );
    const bestByExercise = new Map<string, PersonalRecord>();

    return chronological.map((workout) => {
        let improved = 0;
        let comparable = 0;

        getWorkoutExercises(workout).forEach((exercise) => {
            const best = getBestSet(exercise);
            if (!best) return;

            const key = normalizeExerciseName(best.exercise);
            const previousBest = bestByExercise.get(key);
            if (previousBest) {
                comparable += 1;
                if (beatsRecord(best, previousBest)) improved += 1;
            }
            if (beatsRecord(best, previousBest)) {
                bestByExercise.set(key, { ...best, date: workout.logDate });
            }
        });

        return {
            date: workout.logDate,
            improved,
            comparable,
            percentage: comparable > 0 ? Math.round((improved / comparable) * 100) : 0,
        };
    });
}
