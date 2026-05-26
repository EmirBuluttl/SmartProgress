export type CoachLevel = "beginner" | "intermediate" | "advanced";
export type CoachSplitType = "FB" | "UL" | "AP" | "TL" | "PPL" | "PPLUL";
export type CoachGoal = "muscle" | "strength" | "fat_loss" | "general";

export type CoachPatternKey =
    | "horizontal_adduction"
    | "upper_chest"
    | "shoulder_flexion"
    | "shoulder_extension"
    | "shoulder_adduction"
    | "upper_back"
    | "shoulder_abduction"
    | "elbow_extension"
    | "elbow_flexion"
    | "reverse_curl"
    | "knee_extension"
    | "leg_press"
    | "hip_hinge"
    | "knee_flexion"
    | "hip_adduction"
    | "spinal_flexion"
    | "calf_raise";

export type CoachProfileInput = {
    frequency: number;
    split: CoachSplitType;
    level: CoachLevel;
    goal: CoachGoal;
    hasPain: "no" | "yes";
    painNote?: string;
    equipment?: string;
    sessionMinutes?: string;
    priority?: CoachPatternKey | null;
    avoidNote?: string;
    selectedExercises?: Partial<Record<CoachPatternKey, string>>;
};

export const COACH_LEVELS: { key: CoachLevel; label: string; desc: string; rir: string }[] = [
    { key: "beginner", label: "Başlangıç", desc: "Form, düzen ve güvenli progress.", rir: "2-3" },
    { key: "intermediate", label: "Orta", desc: "Düşük hacim, tükenişe yakın kaliteli set.", rir: "0-1" },
    { key: "advanced", label: "İleri", desc: "Hata payı düşük, recovery odaklı takip.", rir: "1-2" },
];

export const COACH_GOALS: { key: CoachGoal; label: string }[] = [
    { key: "muscle", label: "Kas kazanımı" },
    { key: "strength", label: "Güç artışı" },
    { key: "fat_loss", label: "Yağ kaybına destek" },
    { key: "general", label: "Genel progress" },
];

export const COACH_PRIORITIES: { key: CoachPatternKey; label: string }[] = [
    { key: "shoulder_abduction", label: "Yan omuz" },
    { key: "horizontal_adduction", label: "Göğüs" },
    { key: "upper_chest", label: "Üst göğüs" },
    { key: "shoulder_adduction", label: "Alt kanat" },
    { key: "upper_back", label: "Üst sırt" },
    { key: "elbow_flexion", label: "Biceps" },
    { key: "elbow_extension", label: "Triceps" },
    { key: "leg_press", label: "Bacak" },
    { key: "knee_flexion", label: "Hamstring" },
];

export const COACH_PATTERN_LABELS: Record<CoachPatternKey, string> = {
    horizontal_adduction: "Göğüs",
    upper_chest: "Üst göğüs",
    shoulder_flexion: "Ön omuz",
    shoulder_extension: "Üst kanat",
    shoulder_adduction: "Alt kanat",
    upper_back: "Üst sırt",
    shoulder_abduction: "Yan omuz",
    elbow_extension: "Triceps",
    elbow_flexion: "Biceps",
    reverse_curl: "Brachialis / ön kol",
    knee_extension: "Quadriceps",
    leg_press: "Vastus / leg press",
    hip_hinge: "Hamstring / glute",
    knee_flexion: "Hamstring",
    hip_adduction: "Adductor",
    spinal_flexion: "Abs",
    calf_raise: "Calf",
};

export const COACH_EXERCISE_LIBRARY: Record<CoachPatternKey, string[]> = {
    horizontal_adduction: ["Pec Deck", "Smith Machine Bench Press", "Chest Press Machine", "Bench Press"],
    upper_chest: ["Incline Smith Machine Chest Press", "Seated Low to High Fly", "Incline Dumbbell Press"],
    shoulder_flexion: ["Machine Shoulder Press", "Seated Barbell Shoulder Press", "Dumbbell Shoulder Press"],
    shoulder_extension: ["Close Grip Pulldown", "Chest Supported Close Grip Row", "Narrow Grip Pull Up"],
    shoulder_adduction: ["Wide Grip Pulldown", "Wide Grip Pull Up"],
    upper_back: ["Chest Supported Upper Back Row", "Upper Back Row"],
    shoulder_abduction: ["Starting Hip Cable Lateral Raise", "Machine Lateral Raise", "Seated Dumbbell Lateral Raise"],
    elbow_extension: ["Single Arm Triceps Extension", "Triceps Extension"],
    elbow_flexion: ["Preacher Curl", "Cable Bayesian Curl", "Cable Curl"],
    reverse_curl: ["Reverse Cable Curl", "Reverse Barbell Curl"],
    knee_extension: ["Leg Extension", "Sissy Squat"],
    leg_press: ["Leg Press", "Squat", "Hack Squat"],
    hip_hinge: ["Romanian Deadlift", "Stiff Leg Deadlift", "Hyper Extension"],
    knee_flexion: ["Seated Leg Curl", "Leg Curl"],
    hip_adduction: ["Adductor Machine", "Cable Leg Adduction"],
    spinal_flexion: ["Weighted Ab Crunch", "Cable Crunch", "Elbow Supported Knee Raise"],
    calf_raise: ["Straight Leg Calf Raise", "Bent Knee Calf Raise"],
};

export const COACH_SPLIT_PATTERNS: Record<CoachSplitType, { label: string; days: { label: string; patterns: CoachPatternKey[] }[] }> = {
    FB: {
        label: "Full Body",
        days: [
            { label: "Full Body A", patterns: ["horizontal_adduction", "shoulder_extension", "upper_back", "leg_press", "hip_hinge", "shoulder_abduction", "elbow_extension", "elbow_flexion", "spinal_flexion"] },
            { label: "Full Body B", patterns: ["upper_chest", "shoulder_adduction", "upper_back", "knee_extension", "knee_flexion", "shoulder_abduction", "elbow_extension", "calf_raise"] },
            { label: "Full Body C", patterns: ["horizontal_adduction", "shoulder_extension", "shoulder_adduction", "leg_press", "hip_hinge", "elbow_flexion", "reverse_curl", "spinal_flexion"] },
        ],
    },
    UL: {
        label: "Upper / Lower",
        days: [
            { label: "Upper A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction", "elbow_extension", "elbow_flexion", "reverse_curl"] },
            { label: "Lower A", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Upper B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction", "elbow_extension", "elbow_flexion"] },
            { label: "Lower B", patterns: ["leg_press", "knee_extension", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
    AP: {
        label: "Anterior / Posterior",
        days: [
            { label: "Anterior A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension", "knee_extension", "leg_press", "spinal_flexion"] },
            { label: "Posterior A", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl", "hip_hinge", "knee_flexion", "hip_adduction", "calf_raise"] },
            { label: "Anterior B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension", "knee_extension", "leg_press", "spinal_flexion"] },
            { label: "Posterior B", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl", "hip_hinge", "knee_flexion", "hip_adduction", "calf_raise"] },
        ],
    },
    TL: {
        label: "Torso / Limbs",
        days: [
            { label: "Torso A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction"] },
            { label: "Limbs A", patterns: ["elbow_extension", "elbow_flexion", "reverse_curl", "knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Torso B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction"] },
            { label: "Limbs B", patterns: ["elbow_extension", "elbow_flexion", "reverse_curl", "knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
    PPL: {
        label: "Push / Pull / Legs",
        days: [
            { label: "Push A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension"] },
            { label: "Pull A", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl"] },
            { label: "Legs A", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Push B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension"] },
            { label: "Pull B", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl"] },
            { label: "Legs B", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
    PPLUL: {
        label: "PPL + UL",
        days: [
            { label: "Push", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension"] },
            { label: "Pull", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl"] },
            { label: "Legs", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Upper", patterns: ["horizontal_adduction", "upper_chest", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction", "elbow_extension", "elbow_flexion"] },
            { label: "Lower", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
};

export function defaultSplitForFrequency(frequency: number): CoachSplitType {
    if (frequency <= 3) return "FB";
    if (frequency === 5) return "PPLUL";
    if (frequency >= 6) return "PPL";
    return "UL";
}

export function splitOptionsForFrequency(frequency: number): CoachSplitType[] {
    if (frequency <= 3) return ["FB"];
    if (frequency === 4) return ["UL", "AP", "TL"];
    if (frequency === 5) return ["UL", "AP", "TL", "PPLUL"];
    return ["PPL", "UL", "AP", "TL"];
}

export function splitReason(split: CoachSplitType): string {
    if (split === "UL") return "Bacak gelişimi öncelikliyse veya alt/üst düzeni seviyorsan iyi seçim.";
    if (split === "AP") return "Aynı gün göğüs ve sırt çalışmayı sevmiyorsan daha temiz ayrım sunar.";
    if (split === "TL") return "Kollar eksik bölgeyse torso/limbs ayrımı daha uygun olabilir.";
    if (split === "PPLUL") return "5 günlük düzende PPL hissini koruyup haftayı upper/lower ile tamamlar.";
    if (split === "PPL") return "6 günlük düzende yüksek frekanslı, düzenli takip edilebilir split.";
    return "3 gün veya daha az frekansta frekans/verim oranı en iyi başlangıçtır.";
}

export function workingSetCount(level: CoachLevel): number {
    return level === "beginner" ? 3 : 1;
}

export function targetReps(level: CoachLevel): string {
    return level === "beginner" ? "8-12" : "4-8";
}

export function targetRir(level: CoachLevel): string {
    if (level === "beginner") return "2-3";
    if (level === "intermediate") return "0-1";
    return "1-2";
}

export function reorderForPriority(patterns: CoachPatternKey[], priority: CoachPatternKey | null): CoachPatternKey[] {
    if (!priority || !patterns.includes(priority)) return patterns;
    return [priority, ...patterns.filter((pattern) => pattern !== priority)];
}

export function makeTargetSets(level: CoachLevel) {
    return [
        { targetReps: "3-5", targetRIR: "3-4", isWarmup: true },
        ...Array.from({ length: workingSetCount(level) }, () => ({
            targetReps: targetReps(level),
            targetRIR: targetRir(level),
            isWarmup: false,
        })),
    ];
}

export function makeCoachId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getWorkoutDays(input: Pick<CoachProfileInput, "frequency" | "split" | "priority">) {
    return COACH_SPLIT_PATTERNS[input.split].days.slice(0, input.frequency).map((day) => ({
        ...day,
        patterns: reorderForPriority(day.patterns, input.priority || null),
    }));
}

export function resolveCoachExercise(pattern: CoachPatternKey, selectedExercises?: Partial<Record<CoachPatternKey, string>>) {
    return selectedExercises?.[pattern] || COACH_EXERCISE_LIBRARY[pattern][0];
}

export function buildCoachProgramData(input: CoachProfileInput) {
    const workoutDays = getWorkoutDays(input);
    return {
        frequency: input.frequency,
        splitType: input.split,
        generatedBy: "smartprogress_rule_engine_v1",
        coachProfile: {
            level: input.level,
            goal: input.goal,
            painStatus: input.hasPain,
            painNote: input.painNote?.trim() || undefined,
            equipment: input.equipment?.trim() || "Tam salon varsayıldı",
            sessionMinutes: input.sessionMinutes?.trim() || undefined,
            priorityPattern: input.priority || null,
            avoidNote: input.avoidNote?.trim() || undefined,
        },
        days: workoutDays.map((day) => ({
            label: day.label,
            isRestDay: false,
            exercises: day.patterns.map((pattern) => ({
                id: makeCoachId("exercise"),
                name: resolveCoachExercise(pattern, input.selectedExercises),
                targetPattern: pattern,
                targetMuscle: COACH_PATTERN_LABELS[pattern],
                targetSets: makeTargetSets(input.level),
            })),
        })),
    };
}
