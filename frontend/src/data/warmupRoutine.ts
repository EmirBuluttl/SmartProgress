import type { WarmupRoutineStep } from "../types/workout";

export const DEFAULT_PRE_WORKOUT_WARMUP_STEPS: WarmupRoutineStep[] = [
    {
        id: "general-raise",
        title: "Genel isinma",
        description: "3-5 dk hafif tempo yuruyus, bisiklet veya eklem hareketleriyle nabzi yukselt.",
        durationSeconds: 240,
    },
    {
        id: "rotator-cuff",
        title: "Rotator cuff aktivasyonu",
        description: "Band external rotation veya cable external rotation ile kontrollu 1-2 hafif set.",
        durationSeconds: 120,
    },
    {
        id: "target-joints",
        title: "Gunluk hedef eklemler",
        description: "O gun calisacak omuz, kalca, diz veya dirsek icin agrisiz hareket acikligi hazirligi.",
        durationSeconds: 120,
    },
];
