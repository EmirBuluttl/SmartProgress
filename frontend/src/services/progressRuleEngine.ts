export type ProgressLoadType = "external_load" | "bodyweight" | "assisted_load";

export type ProgressLogEntry = {
    date?: string;
    weight?: number | null;
    reps?: number | null;
    rir?: number | string | null;
    rpe?: number | string | null;
    loadType?: ProgressLoadType;
};

export type ProgressRepRange = {
    min: number;
    max: number;
};

export type ProgressDecisionType =
    | "insufficient_data"
    | "inconsistent_data"
    | "continue_same_weight"
    | "increase_weight"
    | "watch"
    | "raise_rir"
    | "reduce_volume";

export type ProgressAnalysisInput = {
    exerciseName: string;
    repRange: ProgressRepRange;
    workingSetCount: number;
    logs: ProgressLogEntry[];
    loadType?: ProgressLoadType;
    minimumLoadIncrement?: number;
};

export type ProgressAnalysisResult = {
    decision: ProgressDecisionType;
    exerciseName: string;
    reason: string;
    message: string;
    nextTarget?: {
        weight?: number;
        reps?: number;
        rir?: string;
        loadDirection?: "increase" | "decrease";
    };
    flags: string[];
};

type Comparison = "progress_weight" | "progress_reps" | "same" | "regression" | "mixed";
const PERFORMANCE_SCORE_THRESHOLD = 0.03;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function normalizeNumber(value: unknown): number | null {
    if (isFiniteNumber(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

export function normalizeRirValue(value: ProgressLogEntry["rir"]): number | null {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = String(value).replace(",", ".").trim();
    if (text.includes("-")) {
        const parts = text.split("-").map((part) => Number(part.trim())).filter(Number.isFinite);
        if (parts.length > 0) return parts.reduce((sum, part) => sum + part, 0) / parts.length;
    }
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLog(entry: ProgressLogEntry, fallbackLoadType: ProgressLoadType) {
    return {
        ...entry,
        weight: normalizeNumber(entry.weight),
        reps: normalizeNumber(entry.reps),
        rirValue: normalizeRirValue(entry.rir),
        loadType: entry.loadType || fallbackLoadType,
    };
}

function performanceScore(entry: ReturnType<typeof normalizeLog>): number | null {
    if (entry.weight === null || entry.reps === null) return null;
    return Math.max(0, entry.weight) * (1 + Math.max(0, entry.reps) / 30);
}

function compareLogs(previous: ReturnType<typeof normalizeLog>, current: ReturnType<typeof normalizeLog>, repRange: ProgressRepRange): Comparison {
    if (previous.weight === null || current.weight === null || previous.reps === null || current.reps === null) {
        return "mixed";
    }

    const sameLoad = Math.abs(current.weight - previous.weight) < 0.001;
    const currentReachedMinimum = current.reps >= repRange.min;

    if (current.loadType === "assisted_load") {
        if (current.weight < previous.weight && currentReachedMinimum) return "progress_weight";
        if (current.weight > previous.weight && current.reps <= previous.reps) return "regression";
    } else {
        if (current.weight > previous.weight && currentReachedMinimum) return "progress_weight";
        if (current.weight < previous.weight && current.reps > previous.reps) {
            const previousScore = performanceScore(previous);
            const currentScore = performanceScore(current);
            if (previousScore && currentScore) {
                const delta = (currentScore - previousScore) / previousScore;
                if (delta > PERFORMANCE_SCORE_THRESHOLD) return "progress_reps";
                if (delta < -PERFORMANCE_SCORE_THRESHOLD) return "regression";
                return "mixed";
            }
        }
        if (current.weight < previous.weight && current.reps <= previous.reps) return "regression";
    }

    if (sameLoad && current.reps > previous.reps) return "progress_reps";
    if (sameLoad && current.reps === previous.reps) return "same";
    if (sameLoad && current.reps < previous.reps) return "regression";
    return "mixed";
}

function formatLoad(weight: number | undefined, loadType: ProgressLoadType) {
    if (weight === undefined) return "aynı yük";
    if (loadType === "assisted_load") return `${weight}kg yardım`;
    if (loadType === "bodyweight") return "vücut ağırlığı";
    return `${weight}kg`;
}

function nextWeight(currentWeight: number | null, increment: number, loadType: ProgressLoadType) {
    if (currentWeight === null) return undefined;
    return loadType === "assisted_load"
        ? Math.max(0, currentWeight - increment)
        : currentWeight + increment;
}

export function analyzeProgress(input: ProgressAnalysisInput): ProgressAnalysisResult {
    const loadType = input.loadType || "external_load";
    const minimumLoadIncrement = input.minimumLoadIncrement || 1;
    const logs = input.logs.map((entry) => normalizeLog(entry, loadType));
    const validLogs = logs.filter((entry) => entry.weight !== null && entry.reps !== null);
    const flags: string[] = [];

    if (logs.length !== validLogs.length) {
        return {
            decision: "inconsistent_data",
            exerciseName: input.exerciseName,
            reason: "Eksik kilo veya tekrar verisi var.",
            message: `${input.exerciseName} için bazı loglarda kilo veya tekrar eksik. Bu verilerle güvenilir progress kararı vermeyelim; ilgili setleri kontrol edelim.`,
            flags: ["missing_weight_or_reps"],
        };
    }

    if (validLogs.length < 2) {
        return {
            decision: "insufficient_data",
            exerciseName: input.exerciseName,
            reason: "Karar için en az iki session gerekiyor.",
            message: `${input.exerciseName} için henüz yeterli log yok. Bir sonraki sessiondan sonra daha sağlıklı yorum yapabiliriz.`,
            flags,
        };
    }

    const latest = validLogs[validLogs.length - 1];
    const previous = validLogs[validLogs.length - 2];
    const latestComparison = compareLogs(previous, latest, input.repRange);

    if (latest.reps !== null && latest.reps >= input.repRange.max) {
        const targetWeight = nextWeight(latest.weight, minimumLoadIncrement, latest.loadType);
        return {
            decision: "increase_weight",
            exerciseName: input.exerciseName,
            reason: `Tekrar aralığının üst sınırı olan ${input.repRange.max} tekrara ulaşıldı.`,
            message: latest.loadType === "assisted_load"
                ? `${input.exerciseName} hareketinde ${input.repRange.max} tekrar hedefine ulaştın. Bir sonraki sessionda yardımı minimum azaltıp tekrar ${input.repRange.min}+ hedefleyelim.`
                : `${input.exerciseName} hareketinde ${input.repRange.max} tekrar hedefine ulaştın. Bir sonraki sessionda minimum artırılabilir yük kadar artırıp tekrar ${input.repRange.min}+ hedefleyelim.`,
            nextTarget: {
                weight: targetWeight,
                reps: input.repRange.min,
                loadDirection: latest.loadType === "assisted_load" ? "decrease" : "increase",
            },
            flags,
        };
    }

    if (latestComparison === "progress_weight" || latestComparison === "progress_reps") {
        const nextRepTarget = Math.min(input.repRange.max, (latest.reps || input.repRange.min) + 1);
        return {
            decision: "continue_same_weight",
            exerciseName: input.exerciseName,
            reason: latestComparison === "progress_weight" ? "Yük tarafında progress var." : "Aynı yükle tekrar artışı var.",
            message: `${input.exerciseName} hareketinde progress var. Şimdilik yükü değiştirme; ${formatLoad(latest.weight ?? undefined, latest.loadType)} ile ${nextRepTarget} tekrar hedefle. ${input.repRange.max} tekrara ulaştığında yük artışına geçeceğiz.`,
            nextTarget: {
                weight: latest.weight ?? undefined,
                reps: nextRepTarget,
            },
            flags,
        };
    }

    if (validLogs.length >= 3) {
        const beforePrevious = validLogs[validLogs.length - 3];
        const earlierComparison = compareLogs(beforePrevious, previous, input.repRange);
        const hasTwoStalledSessions = (earlierComparison === "same" || earlierComparison === "regression") &&
            (latestComparison === "same" || latestComparison === "regression");
        const lowRir = [beforePrevious, previous, latest].some((entry) => entry.rirValue !== null && entry.rirValue <= 1.25);

        if (hasTwoStalledSessions && lowRir) {
            return {
                decision: "raise_rir",
                exerciseName: input.exerciseName,
                reason: "Üst üste progress yok ve RIR çok düşük.",
                message: `${input.exerciseName} hareketinde son sessionlarda progress yok ve efor çok yüksek görünüyor. Hemen set azaltmayalım; önce aynı yükle RIR 1-2 hedefleyip toparlanmayı rahatlatmayı deneyelim.`,
                nextTarget: {
                    weight: latest.weight ?? undefined,
                    reps: latest.reps ?? undefined,
                    rir: "1-2",
                },
                flags: ["plateau_candidate", "low_rir"],
            };
        }

        if (hasTwoStalledSessions) {
            return {
                decision: "watch",
                exerciseName: input.exerciseName,
                reason: "Üst üste progress yok, fakat RIR kaynaklı net yorgunluk sinyali yok.",
                message: `${input.exerciseName} hareketinde iki sessiondır net progress yok. Bir session daha aynı planı takip edip uyku, beslenme ve dinlenme süresini kontrol edelim.`,
                nextTarget: {
                    weight: latest.weight ?? undefined,
                    reps: Math.min(input.repRange.max, (latest.reps || input.repRange.min) + 1),
                },
                flags: ["watchlist"],
            };
        }
    }

    if (latestComparison === "regression") {
        return {
            decision: "watch",
            exerciseName: input.exerciseName,
            reason: "Son session önceki sessionın gerisinde.",
            message: `${input.exerciseName} hareketinde son session geriye düşmüş. Tek logla program değiştirmeyelim; dinlenme, stres ve pre-workout beslenmeyi kontrol edip bir sonraki sessionı bekleyelim.`,
            flags: ["single_session_regression"],
        };
    }

    return {
        decision: "watch",
        exerciseName: input.exerciseName,
        reason: "Net progress veya müdahale sinyali yok.",
        message: `${input.exerciseName} hareketinde henüz güçlü bir müdahale sinyali yok. Aynı planla devam edip sıradaki logu bekleyelim.`,
        flags,
    };
}
