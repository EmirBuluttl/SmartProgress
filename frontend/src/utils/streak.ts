import { isCycleProgram } from "../types/workout";

function workoutDateKey(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function calculateWorkoutStreak(workouts: any[], programs: any[] = [], activeProgramId?: string | null): number {
    if (!workouts.length) return 0;

    const workedOutDates = new Set(workouts.map((workout) => workoutDateKey(workout.logDate)));
    const today = new Date();
    const activeProgram = activeProgramId
        ? programs.find((program) => program.id === activeProgramId)
        : null;
    const cycleProgram = activeProgram && isCycleProgram(activeProgram.data)
        ? activeProgram
        : programs.find((program) => isCycleProgram(program.data));
    const cycleDays = cycleProgram && isCycleProgram(cycleProgram.data)
        ? cycleProgram.data.days
        : [];
    const currentCycleIndex = cycleProgram?.currentDayIndex ?? 0;
    const weeklyRestDays = new Set<number>();

    if (cycleProgram?.data?.frequency === 7) {
        cycleDays.forEach((day: any, index: number) => {
            if (day.isRestDay) weeklyRestDays.add((index + 1) % 7);
        });
    }

    let streak = 0;
    for (let offset = 0; offset < 365; offset++) {
        const day = new Date(today);
        day.setDate(today.getDate() - offset);
        const key = workoutDateKey(day);
        const cycleDay = cycleDays.length
            ? cycleDays[((currentCycleIndex - offset) % cycleDays.length + cycleDays.length) % cycleDays.length]
            : null;

        if (workedOutDates.has(key)) {
            streak += 1;
            continue;
        }
        if (offset === 0) continue;
        if (cycleDay?.isRestDay || weeklyRestDays.has(day.getDay())) continue;
        break;
    }

    return streak;
}
