export type CoachBestSet = {
    weight: number;
    reps: number;
    rir?: number | string | null;
    targetReps?: string | null;
    weightMode?: "kg" | "bodyweight" | string | null;
    bodyWeight?: number | null;
    externalWeight?: number | null;
};

const PERFORMANCE_SCORE_THRESHOLD = 0.03;

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveCoachSetLoad(set: any): Pick<CoachBestSet, "weight" | "weightMode" | "bodyWeight" | "externalWeight"> {
    const weightMode = set?.weightMode === "bodyweight" ? "bodyweight" : "kg";
    const loggedWeight = toNumber(set?.weight);
    const bodyWeight = toNumber(set?.bodyWeight ?? set?.bodyweight ?? set?.body_weight ?? set?.measuredBodyWeight);
    const externalWeight = toNumber(set?.externalWeight ?? set?.externalLoad ?? set?.additionalWeight ?? set?.addedWeight);

    if (weightMode === "bodyweight") {
        const resolvedBodyWeight = bodyWeight > 0 ? bodyWeight : loggedWeight;
        const hasExternalLoad = externalWeight > 0;
        return {
            weight: hasExternalLoad ? Math.max(0, externalWeight) : 0,
            weightMode,
            bodyWeight: resolvedBodyWeight > 0 ? resolvedBodyWeight : null,
            externalWeight: hasExternalLoad ? externalWeight : null,
        };
    }

    return {
        weight: Math.max(0, loggedWeight),
        weightMode,
        bodyWeight: null,
        externalWeight: null,
    };
}

export type CoachExerciseHistoryEntry = {
    logId: string;
    logDate: Date;
    name: string;
    best: CoachBestSet;
};

export type CoachRecommendation = {
    type: "relax_rir" | "reduce_volume" | "increase_weight" | "increase_volume";
    label: string;
    message: string;
    requiresUserApproval: boolean;
};

export type CoachExerciseSignal = {
    decision: string;
    reason: string;
    flags: string[];
    interventionAdvice: string | null;
    recommendation: CoachRecommendation | null;
    currentBest: CoachBestSet | null;
    previousBest: CoachBestSet | null;
};

export function normalizeRirValue(value: unknown): number | null {
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

export function parseRepRange(value: unknown): { min: number; max: number } | null {
    if (value === null || value === undefined || value === "") return null;
    const text = String(value).replace(",", ".").replace(/[–—]/g, "-").trim();
    if (!text) return null;

    const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
        const left = Number(rangeMatch[1]);
        const right = Number(rangeMatch[2]);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
        return {
            min: Math.floor(Math.min(left, right)),
            max: Math.floor(Math.max(left, right)),
        };
    }

    const single = Number(text.match(/\d+(?:\.\d+)?/)?.[0]);
    if (!Number.isFinite(single)) return null;
    const reps = Math.floor(single);
    return { min: reps, max: reps };
}

function loadStreamFor(set: CoachBestSet | null): string {
    if (!set) return "missing";
    if (set.weightMode === "bodyweight") {
        return set.externalWeight && set.externalWeight > 0 ? "bodyweight_weighted" : "bodyweight_only";
    }
    return "external_load";
}

function performanceScore(set: CoachBestSet): number {
    return Math.max(0, set.weight) * (1 + Math.max(0, set.reps) / 30);
}

function comparePerformanceScore(previous: CoachBestSet, current: CoachBestSet) {
    const previousScore = performanceScore(previous);
    const currentScore = performanceScore(current);
    if (previousScore <= 0 || currentScore <= 0) return null;
    const delta = (currentScore - previousScore) / previousScore;
    if (delta > PERFORMANCE_SCORE_THRESHOLD) {
        return { decision: "progress", reason: "Tahmini performans skoru belirgin artti.", delta };
    }
    if (delta < -PERFORMANCE_SCORE_THRESHOLD) {
        return { decision: "watch", reason: "Tahmini performans skoru belirgin dustu.", delta };
    }
    return { decision: "watch", reason: "Agirlik/tekrar degisimi takip araliginda.", delta };
}

export function compareBestSets(previous: CoachBestSet | null, current: CoachBestSet | null) {
    if (!current) return { decision: "inconsistent_data", reason: "Bu hafta gecerli set verisi yok." };
    if (!previous) return { decision: "baseline", reason: "Bu hareket icin kiyaslanacak onceki log yok." };
    if (loadStreamFor(previous) !== loadStreamFor(current)) {
        return { decision: "watch", reason: "Bodyweight ve ek agirlikli loglar ayri takip edilir." };
    }
    if (current.weight < previous.weight && current.reps > previous.reps) {
        return comparePerformanceScore(previous, current) || { decision: "watch", reason: "Agirlik dustu ama tekrar artti; takip edilmeli." };
    }
    if (current.weight > previous.weight) return { decision: "progress", reason: "Onceki loga gore agirlik artti." };
    if (current.weight === previous.weight && current.reps > previous.reps) return { decision: "progress", reason: "Ayni agirlikla tekrar artti." };
    if (current.weight === previous.weight && current.reps === previous.reps) return { decision: "watch", reason: "Onceki logla ayni seviyede." };
    return { decision: "watch", reason: "Son log onceki logun gerisinde veya karma sinyal var." };
}

export function buildCoachRecommendation(flags: string[]): CoachRecommendation | null {
    if (flags.includes("rir_adjustment_candidate")) {
        return {
            type: "relax_rir",
            label: "RIR hedefini rahatlat",
            message: "Once RIR hedefini biraz rahatlatmayi dusun; hacim azaltimi ikinci adim olsun.",
            requiresUserApproval: true,
        };
    }
    if (flags.includes("volume_reduce_candidate")) {
        return {
            type: "reduce_volume",
            label: "Hacmi azaltmayi degerlendir",
            message: "RIR zaten dusuk gorunmuyorsa bu hareket icin 1 calisma seti azaltimi aday olabilir.",
            requiresUserApproval: true,
        };
    }
    if (flags.includes("weight_increase_candidate")) {
        return {
            type: "increase_weight",
            label: "Minimum agirlik artisi dene",
            message: "Program tekrar araliginin ust sinirina ulasildi. Sonraki sessionda form bozulmadan minimum agirlik artisi denenebilir.",
            requiresUserApproval: true,
        };
    }
    if (flags.includes("volume_increase_candidate")) {
        return {
            type: "increase_volume",
            label: "Set artirmayi degerlendir",
            message: "Ust uste guclu progress var; ayni kalite surerse kullanici onayiyla 1 set artirimi dusunulebilir.",
            requiresUserApproval: true,
        };
    }
    return null;
}

export function compareExerciseHistory(entries: CoachExerciseHistoryEntry[]): CoachExerciseSignal {
    const latest = entries[entries.length - 1];
    const previous = entries[entries.length - 2];
    const beforePrevious = entries[entries.length - 3];
    const comparison = compareBestSets(previous?.best || null, latest?.best || null);
    const flags: string[] = [];

    if (!latest) {
        return {
            decision: "inconsistent_data",
            reason: "Bu hafta gecerli set verisi yok.",
            flags: ["missing_current_best"],
            interventionAdvice: null,
            recommendation: null,
            currentBest: null,
            previousBest: null,
        };
    }

    if (!previous) {
        return {
            decision: "baseline",
            reason: "Bu hareket icin kiyaslanacak onceki log yok.",
            flags: ["baseline"],
            interventionAdvice: null,
            recommendation: null,
            currentBest: latest.best,
            previousBest: null,
        };
    }

    const sameLoadStream = loadStreamFor(latest.best) === loadStreamFor(previous.best);
    const scoreComparison = sameLoadStream && latest.best.weight < previous.best.weight && latest.best.reps > previous.best.reps
        ? comparePerformanceScore(previous.best, latest.best)
        : null;
    const isSameAsPrevious = sameLoadStream && latest.best.weight === previous.best.weight && latest.best.reps === previous.best.reps;
    const isRegression = sameLoadStream && (
        (latest.best.weight < previous.best.weight && scoreComparison?.decision !== "progress" && (scoreComparison?.delta ?? -1) < -PERFORMANCE_SCORE_THRESHOLD) ||
        (latest.best.weight === previous.best.weight && latest.best.reps < previous.best.reps)
    );
    const isStrongProgress = sameLoadStream && (
        latest.best.weight > previous.best.weight ||
        (latest.best.weight === previous.best.weight && latest.best.reps >= previous.best.reps + 2) ||
        scoreComparison?.decision === "progress"
    );
    const repRange = parseRepRange(latest.best.targetReps || previous.best.targetReps);
    const reachedUpperRepTarget = sameLoadStream && !!repRange && latest.best.reps >= repRange.max && latest.best.weight >= previous.best.weight;
    if (isRegression) flags.push("single_session_regression");
    if (isSameAsPrevious) flags.push("same_as_previous");
    if (reachedUpperRepTarget && latest.best.weight > 0) {
        flags.push("upper_rep_target_reached");
        flags.push("weight_increase_candidate");
    }

    if (beforePrevious) {
        const previousSameStream = loadStreamFor(previous.best) === loadStreamFor(beforePrevious.best);
        const latestSameStream = loadStreamFor(latest.best) === loadStreamFor(previous.best);
        const previousWasStalledOrDown = previousSameStream && (
            previous.best.weight < beforePrevious.best.weight ||
            (previous.best.weight === beforePrevious.best.weight && previous.best.reps <= beforePrevious.best.reps)
        );
        const latestStalledOrDown = latestSameStream && (
            (latest.best.weight < previous.best.weight && scoreComparison?.decision !== "progress") ||
            (latest.best.weight === previous.best.weight && latest.best.reps <= previous.best.reps)
        );

        if (previousWasStalledOrDown && latestStalledOrDown) {
            flags.push("plateau_candidate");
            const lowRir = [beforePrevious.best, previous.best, latest.best].some((set) => {
                const rir = normalizeRirValue(set.rir);
                return rir !== null && rir <= 1.75;
            });
            if (lowRir) {
                flags.push("low_rir");
                flags.push("rir_adjustment_candidate");
            } else {
                flags.push("volume_reduce_candidate");
            }
        }

        const previousHadProgress = previousSameStream && (
            previous.best.weight > beforePrevious.best.weight ||
            (previous.best.weight === beforePrevious.best.weight && previous.best.reps > beforePrevious.best.reps)
        );
        if (comparison.decision === "progress" && previousHadProgress && isStrongProgress) {
            flags.push("progress_streak");
            flags.push("volume_increase_candidate");
        }
    }

    const recommendation = buildCoachRecommendation(flags);
    const interventionAdvice = recommendation?.message || null;

    if (comparison.decision === "watch" && flags.includes("plateau_candidate")) {
        return {
            ...comparison,
            reason: flags.includes("low_rir")
                ? "Son 3 sessionda progress yok ve RIR dusuk. Once RIR hedefini rahatlatmak gerekebilir."
                : "Son 3 sessionda net progress yok. Plato adayi olarak takip edilmeli.",
            flags,
            interventionAdvice,
            recommendation,
            currentBest: latest.best,
            previousBest: previous.best,
        };
    }

    return {
        ...comparison,
        flags,
        interventionAdvice,
        recommendation,
        currentBest: latest.best,
        previousBest: previous.best,
    };
}
