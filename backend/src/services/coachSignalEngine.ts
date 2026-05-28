export type CoachBestSet = {
    weight: number;
    reps: number;
    rir?: number | string | null;
    targetReps?: string | null;
    weightMode?: "kg" | "bodyweight" | string | null;
    bodyWeight?: number | null;
    externalWeight?: number | null;
};

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
        return {
            weight: Math.max(0, resolvedBodyWeight + externalWeight),
            weightMode,
            bodyWeight: resolvedBodyWeight > 0 ? resolvedBodyWeight : null,
            externalWeight: externalWeight > 0 ? externalWeight : null,
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

export type CoachExerciseSignal = {
    decision: string;
    reason: string;
    flags: string[];
    interventionAdvice: string | null;
    recommendation: CoachRecommendation | null;
    currentBest: CoachBestSet | null;
    previousBest: CoachBestSet | null;
};

export type CoachRecommendation = {
    type: "relax_rir" | "reduce_volume" | "increase_weight" | "increase_volume";
    label: string;
    message: string;
    requiresUserApproval: boolean;
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

export function compareBestSets(previous: CoachBestSet | null, current: CoachBestSet | null) {
    if (!current) return { decision: "inconsistent_data", reason: "Bu hafta geçerli set verisi yok." };
    if (!previous) return { decision: "baseline", reason: "Bu hareket için kıyaslanacak önceki log yok." };
    if (current.weight > previous.weight) return { decision: "progress", reason: "Önceki loga göre ağırlık arttı." };
    if (current.weight === previous.weight && current.reps > previous.reps) return { decision: "progress", reason: "Aynı ağırlıkla tekrar arttı." };
    if (current.weight === previous.weight && current.reps === previous.reps) return { decision: "watch", reason: "Önceki logla aynı seviyede." };
    return { decision: "watch", reason: "Son log önceki logun gerisinde veya karma sinyal var." };
}

export function buildCoachRecommendation(flags: string[]): CoachRecommendation | null {
    if (flags.includes("rir_adjustment_candidate")) {
        return {
            type: "relax_rir",
            label: "RIR hedefini rahatlat",
            message: "Önce RIR hedefini biraz rahatlatmayı düşün; hacim azaltımı ikinci adım olsun.",
            requiresUserApproval: true,
        };
    }
    if (flags.includes("volume_reduce_candidate")) {
        return {
            type: "reduce_volume",
            label: "Hacmi azaltmayı değerlendir",
            message: "RIR zaten düşük görünmüyorsa bu hareket için 1 çalışma seti azaltımı aday olabilir.",
            requiresUserApproval: true,
        };
    }
    if (flags.includes("weight_increase_candidate")) {
        return {
            type: "increase_weight",
            label: "Minimum ağırlık artışı dene",
            message: "Program tekrar aralığının üst sınırına ulaşıldı. Sonraki sessionda form bozulmadan minimum ağırlık artışı denenebilir.",
            requiresUserApproval: true,
        };
    }
    if (flags.includes("volume_increase_candidate")) {
        return {
            type: "increase_volume",
            label: "Set artırmayı değerlendir",
            message: "Üst üste güçlü progress var; aynı kalite sürerse kullanıcı onayıyla 1 set artırımı düşünülebilir.",
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

    const isSameAsPrevious = latest.best.weight === previous.best.weight && latest.best.reps === previous.best.reps;
    const isRegression = latest.best.weight < previous.best.weight ||
        (latest.best.weight === previous.best.weight && latest.best.reps < previous.best.reps);
    const isStrongProgress = latest.best.weight > previous.best.weight ||
        (latest.best.weight === previous.best.weight && latest.best.reps >= previous.best.reps + 2);
    const repRange = parseRepRange(latest.best.targetReps || previous.best.targetReps);
    const reachedUpperRepTarget = !!repRange && latest.best.reps >= repRange.max && latest.best.weight >= previous.best.weight;
    if (isRegression) flags.push("single_session_regression");
    if (isSameAsPrevious) flags.push("same_as_previous");
    if (reachedUpperRepTarget && latest.best.weight > 0) {
        flags.push("upper_rep_target_reached");
        flags.push("weight_increase_candidate");
    }

    if (beforePrevious) {
        const previousWasStalledOrDown = previous.best.weight < beforePrevious.best.weight ||
            (previous.best.weight === beforePrevious.best.weight && previous.best.reps <= beforePrevious.best.reps);
        const latestStalledOrDown = latest.best.weight < previous.best.weight ||
            (latest.best.weight === previous.best.weight && latest.best.reps <= previous.best.reps);

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

        const previousHadProgress = previous.best.weight > beforePrevious.best.weight ||
            (previous.best.weight === beforePrevious.best.weight && previous.best.reps > beforePrevious.best.reps);
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
