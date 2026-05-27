export type CoachBestSet = {
    weight: number;
    reps: number;
    rir?: number | string | null;
};

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

export function compareBestSets(previous: CoachBestSet | null, current: CoachBestSet | null) {
    if (!current) return { decision: "inconsistent_data", reason: "Bu hafta geçerli set verisi yok." };
    if (!previous) return { decision: "baseline", reason: "Bu hareket için kıyaslanacak önceki log yok." };
    if (current.weight > previous.weight) return { decision: "progress", reason: "Önceki loga göre ağırlık arttı." };
    if (current.weight === previous.weight && current.reps > previous.reps) return { decision: "progress", reason: "Aynı ağırlıkla tekrar arttı." };
    if (current.weight === previous.weight && current.reps === previous.reps) return { decision: "watch", reason: "Önceki logla aynı seviyede." };
    return { decision: "watch", reason: "Son log önceki logun gerisinde veya karma sinyal var." };
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
            currentBest: latest.best,
            previousBest: null,
        };
    }

    const isSameAsPrevious = latest.best.weight === previous.best.weight && latest.best.reps === previous.best.reps;
    const isRegression = latest.best.weight < previous.best.weight ||
        (latest.best.weight === previous.best.weight && latest.best.reps < previous.best.reps);
    const isStrongProgress = latest.best.weight > previous.best.weight ||
        (latest.best.weight === previous.best.weight && latest.best.reps >= previous.best.reps + 2);
    if (isRegression) flags.push("single_session_regression");
    if (isSameAsPrevious) flags.push("same_as_previous");

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

    const interventionAdvice = flags.includes("rir_adjustment_candidate")
        ? "Önce RIR hedefini biraz rahatlatmayı düşün; hacim azaltımı ikinci adım olsun."
        : flags.includes("volume_reduce_candidate")
            ? "RIR zaten düşük görünmüyorsa bu hareket için hacim azaltımı aday olabilir."
            : flags.includes("volume_increase_candidate")
                ? "Üst üste güçlü progress var; aynı kalite sürerse kullanıcı onayıyla set artırımı düşünülebilir."
                : null;

    if (comparison.decision === "watch" && flags.includes("plateau_candidate")) {
        return {
            ...comparison,
            reason: flags.includes("low_rir")
                ? "Son 3 sessionda progress yok ve RIR dusuk. Once RIR hedefini rahatlatmak gerekebilir."
                : "Son 3 sessionda net progress yok. Plato adayi olarak takip edilmeli.",
            flags,
            interventionAdvice,
            currentBest: latest.best,
            previousBest: previous.best,
        };
    }

    return {
        ...comparison,
        flags,
        interventionAdvice,
        currentBest: latest.best,
        previousBest: previous.best,
    };
}
