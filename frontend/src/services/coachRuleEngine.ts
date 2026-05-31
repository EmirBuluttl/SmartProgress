export type CoachLevel = "beginner" | "intermediate" | "advanced";
export type CoachSplitType = "FB" | "UL" | "AP" | "TL" | "PPL" | "PPLUL";
export type CoachGoal = "muscle" | "strength" | "fat_loss" | "general";
export type CoachStrengthFocus = "overall" | "powerlifting" | "streetlifting";
export type CoachSessionDuration = "45-60" | "60-90" | "90+";

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

export type CoachPlanDay = {
    label: string;
    isRestDay?: boolean;
    patterns: CoachPatternKey[];
};

export type CoachProfileInput = {
    frequency: number;
    split: CoachSplitType;
    level: CoachLevel;
    goal: CoachGoal;
    hasPain: "no" | "yes";
    painNote?: string;
    includePainArea?: "no" | "yes";
    hasEquipmentLimit?: "no" | "yes";
    equipmentLimitNote?: string;
    sessionDuration?: CoachSessionDuration;
    strengthFocus?: CoachStrengthFocus;
    priority?: CoachPatternKey | null;
    priorityOrder?: CoachPatternKey[];
    avoidNote?: string;
    avoidExercises?: string[];
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

export const COACH_STRENGTH_FOCUS_OPTIONS: { key: CoachStrengthFocus; label: string; desc: string }[] = [
    { key: "overall", label: "Genel kuvvet", desc: "Mevcut split içinde kontrollü güçlenme." },
    { key: "powerlifting", label: "Powerlifting", desc: "Squat, bench ve deadlift odağı." },
    { key: "streetlifting", label: "Streetlifting", desc: "Pull-up, dip ve vücut ağırlığı kuvveti odağı." },
];

export const COACH_SESSION_DURATIONS: { key: CoachSessionDuration; label: string; desc: string }[] = [
    { key: "45-60", label: "45-60 dk", desc: "Daha kompakt ve sürdürülebilir akış." },
    { key: "60-90", label: "60-90 dk", desc: "Standart hipertrofi/progress akışı." },
    { key: "90+", label: "90+ dk", desc: "Daha geniş zaman, daha rahat dinlenme." },
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

export const COACH_PRIORITY_GROUPS: { key: string; label: string; patterns: CoachPatternKey[] }[] = [
    { key: "shoulders", label: "Omuz", patterns: ["shoulder_abduction", "shoulder_flexion"] },
    { key: "chest", label: "Göğüs", patterns: ["horizontal_adduction", "upper_chest"] },
    { key: "back", label: "Sırt", patterns: ["shoulder_adduction", "shoulder_extension", "upper_back"] },
    { key: "arms", label: "Kol", patterns: ["elbow_flexion", "elbow_extension", "reverse_curl"] },
    { key: "legs", label: "Bacak", patterns: ["leg_press", "knee_extension", "knee_flexion", "hip_hinge", "hip_adduction", "calf_raise"] },
    { key: "core", label: "Karın", patterns: ["spinal_flexion"] },
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
    leg_press: "Vastuslar (ön bacak)",
    hip_hinge: "Hamstring/Glute",
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

const PRIORITY_CLUSTERS: Partial<Record<CoachPatternKey, CoachPatternKey[]>> = {
    shoulder_abduction: ["shoulder_abduction", "shoulder_flexion"],
    shoulder_flexion: ["shoulder_flexion", "shoulder_abduction"],
    shoulder_adduction: ["shoulder_adduction", "shoulder_extension", "upper_back"],
    shoulder_extension: ["shoulder_extension", "shoulder_adduction", "upper_back"],
    upper_back: ["upper_back", "shoulder_extension", "shoulder_adduction"],
    horizontal_adduction: ["horizontal_adduction", "upper_chest", "shoulder_flexion"],
    upper_chest: ["upper_chest", "horizontal_adduction", "shoulder_flexion"],
    leg_press: ["leg_press", "knee_extension", "knee_flexion", "hip_hinge"],
    knee_extension: ["knee_extension", "leg_press", "knee_flexion", "hip_hinge"],
    knee_flexion: ["knee_flexion", "hip_hinge", "leg_press", "knee_extension"],
};

export function buildPriorityOrder(priority: CoachPatternKey | null, priorityOrder: CoachPatternKey[] = []): CoachPatternKey[] {
    const order = priorityOrder.length > 0 ? priorityOrder : (priority ? [priority] : []);
    const expanded = order.flatMap((pattern) => PRIORITY_CLUSTERS[pattern] || [pattern]);
    return Array.from(new Set(expanded));
}

export function reorderForPriority(
    patterns: CoachPatternKey[],
    priority: CoachPatternKey | null,
    priorityOrder: CoachPatternKey[] = [],
): CoachPatternKey[] {
    const expandedOrder = buildPriorityOrder(priority, priorityOrder);
    if (expandedOrder.length === 0) return patterns;
    const prioritized = expandedOrder.filter((pattern) => patterns.includes(pattern));
    const remaining = patterns.filter((pattern) => !prioritized.includes(pattern));
    return [...prioritized, ...remaining];
}

function hasSpecificStrengthFocus(input: Pick<CoachProfileInput, "goal" | "strengthFocus">) {
    return input.goal === "strength" && input.strengthFocus && input.strengthFocus !== "overall";
}

export function workingSetCountForInput(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus" | "hasPain">): number {
    if (input.hasPain === "yes") return Math.min(workingSetCount(input.level), 2);
    if (hasSpecificStrengthFocus(input)) return Math.min(workingSetCount(input.level) + 1, 3);
    return workingSetCount(input.level);
}

export function targetRepsForInput(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus">): string {
    if (input.goal === "fat_loss" && input.level !== "advanced") return "8-10";
    if (hasSpecificStrengthFocus(input)) return "3-6";
    return targetReps(input.level);
}

export function targetRirForInput(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus" | "hasPain">): string {
    if (input.hasPain === "yes") return "3-4";
    if (hasSpecificStrengthFocus(input)) return input.level === "beginner" ? "2-3" : "1-2";
    return targetRir(input.level);
}

export function makeTargetSets(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus" | "hasPain">) {
    return [
        { targetReps: "3-5", targetRIR: "3-4", isWarmup: true },
        ...Array.from({ length: workingSetCountForInput(input) }, () => ({
            targetReps: targetRepsForInput(input),
            targetRIR: targetRirForInput(input),
            isWarmup: false,
        })),
    ];
}

export function makeCoachId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function restDay(label = "Dinlenme"): CoachPlanDay {
    return { label, isRestDay: true, patterns: [] };
}

export function getTrainingDays(input: Pick<CoachProfileInput, "frequency" | "split" | "priority" | "priorityOrder">): CoachPlanDay[] {
    return COACH_SPLIT_PATTERNS[input.split].days.slice(0, input.frequency).map((day) => ({
        ...day,
        patterns: reorderForPriority(day.patterns, input.priority || null, input.priorityOrder || []),
    }));
}

export function getWorkoutDays(input: Pick<CoachProfileInput, "frequency" | "split" | "priority" | "priorityOrder">): CoachPlanDay[] {
    const trainingDays = getTrainingDays(input);

    if (input.frequency === 2) {
        return [trainingDays[0], restDay(), restDay(), trainingDays[1], restDay(), restDay(), restDay()].filter(Boolean) as CoachPlanDay[];
    }
    if (input.frequency === 3) {
        return [trainingDays[0], restDay(), trainingDays[1], restDay(), trainingDays[2], restDay(), restDay()].filter(Boolean) as CoachPlanDay[];
    }
    if (input.frequency === 4) {
        return [trainingDays[0], trainingDays[1], restDay(), trainingDays[2], trainingDays[3], restDay()].filter(Boolean) as CoachPlanDay[];
    }
    if (input.frequency === 5) {
        return [trainingDays[0], trainingDays[1], trainingDays[2], restDay(), trainingDays[3], trainingDays[4], restDay()].filter(Boolean) as CoachPlanDay[];
    }
    if (input.frequency >= 6) {
        return [trainingDays[0], trainingDays[1], trainingDays[2], trainingDays[3], trainingDays[4], trainingDays[5], restDay()].filter(Boolean) as CoachPlanDay[];
    }

    return trainingDays;
}

export function resolveCoachExercise(pattern: CoachPatternKey, selectedExercises?: Partial<Record<CoachPatternKey, string>>) {
    return selectedExercises?.[pattern] || COACH_EXERCISE_LIBRARY[pattern][0];
}

function normalizeText(value: string) {
    return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ığüşöç\s]/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseAvoidedExercises(avoidNote?: string, avoidExercises: string[] = []) {
    const noteItems = (avoidNote || "")
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set([...avoidExercises, ...noteItems].map(normalizeText).filter(Boolean)));
}

export function getAvailableExercises(pattern: CoachPatternKey, avoidNote?: string, avoidExercises: string[] = []) {
    const avoided = parseAvoidedExercises(avoidNote, avoidExercises);
    if (avoided.length === 0) return COACH_EXERCISE_LIBRARY[pattern];

    const filtered = COACH_EXERCISE_LIBRARY[pattern].filter((exercise) => {
        const normalizedExercise = normalizeText(exercise);
        return !avoided.some((avoidedExercise) =>
            normalizedExercise === avoidedExercise ||
            normalizedExercise.includes(avoidedExercise) ||
            avoidedExercise.includes(normalizedExercise),
        );
    });

    return filtered.length > 0 ? filtered : COACH_EXERCISE_LIBRARY[pattern];
}

export function resolveCoachExerciseWithAvoidance(
    pattern: CoachPatternKey,
    selectedExercises?: Partial<Record<CoachPatternKey, string>>,
    avoidNote?: string,
    avoidExercises: string[] = [],
) {
    const available = getAvailableExercises(pattern, avoidNote, avoidExercises);
    const selected = selectedExercises?.[pattern];
    return selected && available.includes(selected) ? selected : available[0];
}

export function inferPainLimitedPatterns(painNote?: string): CoachPatternKey[] {
    const text = normalizeText(painNote || "");
    if (!text) return [];

    const patterns = new Set<CoachPatternKey>();
    if (/(diz|knee|bacak|leg|quad|quadriceps|patella)/i.test(text)) {
        ["leg_press", "knee_extension", "knee_flexion", "hip_hinge", "calf_raise"].forEach((pattern) => patterns.add(pattern as CoachPatternKey));
    }
    if (/(omuz|shoulder|rotator|kolumu kald|press)/i.test(text)) {
        ["shoulder_abduction", "shoulder_flexion", "upper_chest", "horizontal_adduction"].forEach((pattern) => patterns.add(pattern as CoachPatternKey));
    }
    if (/(bel|sirt|sırt|back|腰|deadlift|hinge)/i.test(text)) {
        ["hip_hinge", "shoulder_extension", "shoulder_adduction", "upper_back"].forEach((pattern) => patterns.add(pattern as CoachPatternKey));
    }
    if (/(dirsek|elbow|bilek|wrist)/i.test(text)) {
        ["elbow_flexion", "elbow_extension", "reverse_curl"].forEach((pattern) => patterns.add(pattern as CoachPatternKey));
    }
    return Array.from(patterns);
}

export function buildCoachProgramData(input: CoachProfileInput) {
    const workoutDays = getWorkoutDays(input);
    const painLimitedPatterns = input.hasPain === "yes" ? inferPainLimitedPatterns(input.painNote) : [];
    const shouldExcludePainPatterns = input.hasPain === "yes" && input.includePainArea === "no";
    const equipmentText = input.hasEquipmentLimit === "yes" && input.equipmentLimitNote?.trim()
        ? input.equipmentLimitNote.trim()
        : "Tam salon erişimi varsayıldı";
    return {
        frequency: input.frequency,
        splitType: input.split,
        generatedBy: "smartprogress_rule_engine_v1",
        coachProfile: {
            level: input.level,
            goal: input.goal,
            strengthFocus: input.strengthFocus || "overall",
            painStatus: input.hasPain,
            painNote: input.painNote?.trim() || undefined,
            includePainArea: input.includePainArea || "yes",
            painLimitedPatterns,
            equipment: equipmentText,
            sessionDuration: input.sessionDuration || "60-90",
            priorityPattern: input.priority || null,
            priorityOrder: input.priorityOrder || [],
            avoidNote: input.avoidNote?.trim() || undefined,
        },
        days: workoutDays.map((day) => ({
            label: day.label,
            isRestDay: !!day.isRestDay,
            exercises: day.isRestDay ? [] : day.patterns
                .filter((pattern) => !shouldExcludePainPatterns || !painLimitedPatterns.includes(pattern))
                .map((pattern) => ({
                id: makeCoachId("exercise"),
                name: resolveCoachExerciseWithAvoidance(pattern, input.selectedExercises, input.avoidNote, input.avoidExercises),
                targetPattern: pattern,
                targetMuscle: COACH_PATTERN_LABELS[pattern],
                riskAdjusted: painLimitedPatterns.includes(pattern),
                targetSets: makeTargetSets({
                    level: input.level,
                    goal: input.goal,
                    strengthFocus: input.strengthFocus,
                    hasPain: painLimitedPatterns.includes(pattern) ? "yes" : "no",
                }),
            })),
        })),
    };
}
