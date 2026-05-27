type BestSet = {
    weight: number;
    reps: number;
    rir?: number | string | null;
};

export type CoachExerciseAnalysis = {
    exerciseName: string;
    decision: string;
    reason: string;
    flags?: string[];
    currentBest?: BestSet | null;
    previousBest?: BestSet | null;
};

export type CoachNarrationInput = {
    workoutCount: number;
    progressCount: number;
    watchCount: number;
    plateauCount?: number;
    regressionCount?: number;
    exerciseAnalyses: CoachExerciseAnalysis[];
};

export type CoachNarration = {
    mode: "rule_based";
    headline: string;
    summary: string;
    highlights: string[];
    nextActions: string[];
    cautions: string[];
};

function formatBestSet(set?: BestSet | null) {
    if (!set) return "log yok";
    const rirText = set.rir !== null && set.rir !== undefined && String(set.rir).trim()
        ? `, RIR ${set.rir}`
        : "";
    return `${set.weight} kg x ${set.reps}${rirText}`;
}

function formatProgressLine(item: CoachExerciseAnalysis) {
    return `${item.exerciseName}: ${formatBestSet(item.previousBest)} -> ${formatBestSet(item.currentBest)}.`;
}

export class CoachNarrationService {
    buildWeeklyNarration(input: CoachNarrationInput): CoachNarration {
        const progressItems = input.exerciseAnalyses.filter((item) => item.decision === "progress");
        const watchItems = input.exerciseAnalyses.filter((item) => item.decision === "watch");
        const plateauItems = input.exerciseAnalyses.filter((item) => item.flags?.includes("plateau_candidate"));
        const regressionItems = input.exerciseAnalyses.filter((item) => item.flags?.includes("single_session_regression"));
        const baselineItems = input.exerciseAnalyses.filter((item) => item.decision === "baseline");
        const inconsistentItems = input.exerciseAnalyses.filter((item) => item.decision === "inconsistent_data");

        if (input.workoutCount === 0) {
            return {
                mode: "rule_based",
                headline: "Rapor icin log bekleniyor",
                summary: "Bu hafta koç yorumu üretmek için henüz yeterli antrenman logu yok.",
                highlights: [],
                nextActions: [
                    "Bir antrenman logladıktan sonra hareket bazlı progress ve takip sinyallerini burada görebilirsin.",
                ],
                cautions: [],
            };
        }

        const headline = progressItems.length > 0
            ? "Bu hafta net progress var"
            : watchItems.length > 0
                ? "Bu hafta takip edilmesi gereken hareketler var"
                : "Bu hafta baz veriler toplandı";

        const highlights = progressItems.slice(0, 3).map(formatProgressLine);
        if (baselineItems.length > 0) {
            highlights.push(`${baselineItems.length} hareket için baz performans kaydedildi.`);
        }

        const nextActions: string[] = [];
        if (progressItems.length > 0) {
            nextActions.push("Progress aldığın hareketlerde aynı form standardını koruyarak sonraki hedefe devam et.");
        }
        if (watchItems.length > 0) {
            nextActions.push(`${watchItems.slice(0, 3).map((item) => item.exerciseName).join(", ")} hareketlerini bir sonraki sessionda tekrar izle.`);
        }
        if (plateauItems.length > 0) {
            nextActions.push(`${plateauItems.slice(0, 3).map((item) => item.exerciseName).join(", ")} için plato sinyali var; RIR, dinlenme ve hacim kararını takip et.`);
        }
        if (baselineItems.length > 0 && progressItems.length === 0) {
            nextActions.push("Yeni baz alınan hareketlerde bir sonraki log karşılaştırma için daha anlamlı olacak.");
        }

        const cautions: string[] = [];
        if (watchItems.length >= 3) {
            cautions.push("Birden fazla hareket takipte. Uyku, beslenme, dinlenme ve RIR tutarlılığını kontrol etmek iyi olur.");
        }
        if (regressionItems.length > 0) {
            cautions.push(`${regressionItems.slice(0, 3).map((item) => item.exerciseName).join(", ")} için önceki loga göre kg veya tekrar düşüşü var.`);
        }
        if (inconsistentItems.length > 0) {
            cautions.push(`${inconsistentItems.length} hareket veri tutarsızlığı yüzünden koç kararına dahil edilmedi.`);
        }

        return {
            mode: "rule_based",
            headline,
            summary: `${input.workoutCount} antrenman içinde ${input.progressCount} progress, ${input.plateauCount || 0} plato adayı ve ${input.regressionCount || 0} gerileme sinyali bulundu.`,
            highlights: highlights.length > 0 ? highlights : ["Bu hafta belirgin progress sinyali yok; baz ve takip verileri oluşuyor."],
            nextActions: nextActions.length > 0 ? nextActions : ["Bir sonraki antrenmanda aynı log disiplinini sürdür."],
            cautions,
        };
    }
}

export const coachNarrationService = new CoachNarrationService();
