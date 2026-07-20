import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "../data/exerciseLibrary";
import { getExerciseMetadata } from "../data/exerciseMetadata";

export type CoachLevel = "beginner" | "intermediate" | "advanced";
export type CoachSplitType = "FB" | "UL" | "AP" | "TL" | "PPL" | "PPLUL";
export type CoachGoal = "muscle" | "strength" | "fat_loss" | "general";
export type CoachProgramStyle = "hypertrophy" | "calisthenics" | "streetlifting" | "powerlifting" | "crossfit";
export type CoachStrengthFocus = "overall" | "powerlifting" | "streetlifting";
export type CoachSessionDuration = "45-60" | "60-90" | "90+";

export type CoachPatternKey =
    | "horizontal_adduction"
    | "upper_chest"
    | "shoulder_flexion"
    | "shoulder_extension"
    | "shoulder_adduction"
    | "upper_back"
    | "rear_delt"
    | "trapezius"
    | "rotator_cuff"
    | "shoulder_abduction"
    | "elbow_extension"
    | "elbow_flexion"
    | "reverse_curl"
    | "knee_extension"
    | "leg_press"
    | "hip_hinge"
    | "hip_abduction"
    | "knee_flexion"
    | "hip_adduction"
    | "spinal_flexion"
    | "spinal_extension"
    | "spinal_rotation"
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
    programStyle?: CoachProgramStyle;
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

type ExerciseSelectionOptions = {
    hasEquipmentLimit?: "no" | "yes";
    equipmentLimitNote?: string;
    painNote?: string;
    preferPainSafe?: boolean;
    level?: CoachLevel;
    goal?: CoachGoal;
    programStyle?: CoachProgramStyle;
    strengthFocus?: CoachStrengthFocus;
    allowUnsafeFallback?: boolean;
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

export const COACH_PROGRAM_STYLES: { key: CoachProgramStyle; label: string; desc: string }[] = [
    { key: "hypertrophy", label: "Hipertrofi / kas gelistirme", desc: "Mevcut SmartProgress rule engine akisi." },
    { key: "calisthenics", label: "Calisthenics", desc: "Bodyweight ve stabil varyasyonlari daha one alir." },
    { key: "streetlifting", label: "Streetlifting", desc: "Pull-up, dip ve agirlikli bodyweight odagini one alir." },
    { key: "powerlifting", label: "Powerlifting", desc: "Compound ve barbell odagini one alir." },
    { key: "crossfit", label: "CrossFit", desc: "V1'de stil olarak kaydedilir; metcon motoru eklenmez." },
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
    { key: "horizontal_adduction", label: "Göğüs" },
    { key: "upper_chest", label: "Üst göğüs" },
    { key: "shoulder_flexion", label: "Ön omuz" },
    { key: "shoulder_abduction", label: "Yan omuz" },
    { key: "rear_delt", label: "Arka omuz" },
    { key: "trapezius", label: "Trapez" },
    { key: "elbow_flexion", label: "Biceps" },
    { key: "reverse_curl", label: "Brachialis / Bilek" },
    { key: "elbow_extension", label: "Triceps" },
    { key: "shoulder_adduction", label: "Alt kanat" },
    { key: "shoulder_extension", label: "Üst kanat" },
    { key: "upper_back", label: "Üst sırt" },
    { key: "knee_extension", label: "Quadriceps" },
    { key: "knee_flexion", label: "Hamstring" },
    { key: "hip_abduction", label: "Glute" },
    { key: "calf_raise", label: "Calve" },
    { key: "hip_adduction", label: "Adductor" },
];

export const COACH_PRIORITY_GROUPS: { key: string; label: string; patterns: CoachPatternKey[] }[] = [
    { key: "shoulders", label: "Omuz", patterns: ["shoulder_abduction", "shoulder_flexion", "rear_delt", "rotator_cuff"] },
    { key: "chest", label: "Göğüs", patterns: ["horizontal_adduction", "upper_chest"] },
    { key: "back", label: "Sırt", patterns: ["shoulder_adduction", "shoulder_extension", "upper_back", "trapezius"] },
    { key: "arms", label: "Kol", patterns: ["elbow_flexion", "elbow_extension", "reverse_curl"] },
    { key: "legs", label: "Bacak", patterns: ["leg_press", "knee_extension", "knee_flexion", "hip_hinge", "hip_abduction", "hip_adduction", "calf_raise"] },
    { key: "core", label: "Karın", patterns: ["spinal_flexion", "spinal_extension", "spinal_rotation"] },
];

const SHOULDER_PATTERNS: CoachPatternKey[] = ["shoulder_abduction", "shoulder_flexion", "rear_delt", "rotator_cuff"];
const CHEST_PATTERNS: CoachPatternKey[] = ["horizontal_adduction", "upper_chest"];
const BACK_PATTERNS: CoachPatternKey[] = ["shoulder_adduction", "shoulder_extension", "upper_back", "trapezius", "rear_delt"];
const LEG_PATTERNS: CoachPatternKey[] = ["leg_press", "knee_extension", "knee_flexion", "hip_hinge", "hip_abduction", "hip_adduction", "calf_raise"];
const ARM_PATTERNS: CoachPatternKey[] = ["elbow_flexion", "elbow_extension", "reverse_curl"];

function addPatterns(target: Set<CoachPatternKey>, patterns: CoachPatternKey[]) {
    patterns.forEach((pattern) => target.add(pattern));
}

export function isInjuryNote(note?: string) {
    const raw = String(note || "").toLocaleLowerCase("tr-TR");
    const text = `${raw} ${normalizeExerciseText(note || "")}`;
    return /(sakat|sakatl[ıi]k|sakatl[ıi]g[ıi]|sakatl|injury|injured|y[ıi]rt[ıi]k|kopuk|ameliyat|meniskus|meniscus|f[ıi]t[ıi]k)/i.test(text);
}

export const COACH_PATTERN_LABELS: Record<CoachPatternKey, string> = {
    horizontal_adduction: "Göğüs",
    upper_chest: "Üst göğüs",
    shoulder_flexion: "Ön omuz",
    shoulder_extension: "Üst kanat",
    shoulder_adduction: "Alt kanat",
    upper_back: "Üst sırt",
    rear_delt: "Arka omuz",
    trapezius: "Trapez",
    rotator_cuff: "Rotator cuff",
    shoulder_abduction: "Yan omuz",
    elbow_extension: "Triceps",
    elbow_flexion: "Biceps",
    reverse_curl: "Brachialis / ön kol",
    knee_extension: "Quadriceps",
    leg_press: "Vastuslar (ön bacak)",
    hip_hinge: "Hinge",
    hip_abduction: "Glute",
    knee_flexion: "Hamstring",
    hip_adduction: "Adductor",
    spinal_flexion: "Abs",
    spinal_extension: "Spine extension",
    spinal_rotation: "Spine rotation",
    calf_raise: "Calve",
};

export const COACH_EXERCISE_LIBRARY: Record<CoachPatternKey, string[]> = EXERCISE_LIBRARY.reduce((acc, exercise) => {
    const pattern = exercise.pattern as CoachPatternKey;
    acc[pattern] = [...(acc[pattern] || []), exercise.name];
    return acc;
}, {} as Record<CoachPatternKey, string[]>);

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

export function defaultSplitForFrequency(frequency: number, _programStyle: CoachProgramStyle = "hypertrophy"): CoachSplitType {
    if (frequency <= 3) return "FB";
    if (frequency === 5) return "PPLUL";
    if (frequency >= 6) return "PPL";
    return "UL";
}

export function splitOptionsForFrequency(frequency: number, _programStyle: CoachProgramStyle = "hypertrophy"): CoachSplitType[] {
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
    if (level === "beginner") return 3;
    if (level === "intermediate") return 2;
    return 1;
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
    shoulder_abduction: ["shoulder_abduction"],
    shoulder_flexion: ["shoulder_flexion"],
    rear_delt: ["rear_delt"],
    trapezius: ["trapezius"],
    rotator_cuff: ["rotator_cuff"],
    shoulder_adduction: ["shoulder_adduction", "shoulder_extension"],
    shoulder_extension: ["shoulder_extension", "shoulder_adduction"],
    upper_back: ["upper_back", "trapezius", "rear_delt"],
    horizontal_adduction: ["horizontal_adduction", "upper_chest"],
    upper_chest: ["upper_chest", "horizontal_adduction"],
    leg_press: ["leg_press", "knee_extension"],
    knee_extension: ["knee_extension"],
    knee_flexion: ["knee_flexion", "hip_hinge"],
    hip_hinge: ["hip_hinge", "knee_flexion"],
    hip_abduction: ["hip_abduction"],
    spinal_flexion: ["spinal_flexion", "spinal_rotation", "spinal_extension"],
    spinal_extension: ["spinal_extension", "spinal_flexion", "spinal_rotation"],
    spinal_rotation: ["spinal_rotation", "spinal_flexion", "spinal_extension"],
};

export function buildPriorityOrder(priority: CoachPatternKey | null, priorityOrder: CoachPatternKey[] = []): CoachPatternKey[] {
    const order = priorityOrder.length > 0 ? priorityOrder : (priority ? [priority] : []);
    const expanded = order.flatMap((pattern) => PRIORITY_CLUSTERS[pattern] || [pattern]);
    return Array.from(new Set(expanded));
}

export function isUpperBackClusterComplete(order: CoachPatternKey[]) {
    return order.includes("upper_back") || order.includes("trapezius") || order.includes("rear_delt");
}

export function applyPrioritySelectionRules(current: CoachPatternKey[], nextPattern: CoachPatternKey, guidanceEnabled = true): CoachPatternKey[] {
    if (!guidanceEnabled) {
        return current.includes(nextPattern)
            ? current.filter((pattern) => pattern !== nextPattern)
            : [...current, nextPattern];
    }

    if (current.includes(nextPattern)) return current.filter((pattern) => pattern !== nextPattern);

    const next = [...current, nextPattern];
    const addAfter = (pattern: CoachPatternKey) => {
        if (!next.includes(pattern)) next.push(pattern);
    };

    if (nextPattern === "shoulder_adduction") addAfter("shoulder_extension");
    if (nextPattern === "shoulder_extension") addAfter("shoulder_adduction");
    if (nextPattern === "trapezius") addAfter("rear_delt");
    if (nextPattern === "rear_delt") addAfter("trapezius");
    if (nextPattern === "horizontal_adduction") addAfter("upper_chest");
    if (nextPattern === "leg_press") addAfter("knee_extension");
    if (nextPattern === "hip_hinge") addAfter("knee_flexion");
    if (nextPattern === "knee_flexion") addAfter("hip_hinge");

    return Array.from(new Set(next));
}

export function isPriorityChoiceLocked(pattern: CoachPatternKey, order: CoachPatternKey[], guidanceEnabled = true) {
    if (!guidanceEnabled || order.includes(pattern) || order.length === 0) return false;
    const hasBackFocus = order.some((item) => BACK_PATTERNS.includes(item));
    const hasLegFocus = order.some((item) => LEG_PATTERNS.includes(item));

    if (hasBackFocus && !isUpperBackClusterComplete(order)) return !BACK_PATTERNS.includes(pattern);

    if (hasLegFocus) {
        const needsKneeExtension = order.includes("leg_press") && !order.includes("knee_extension");
        const needsHinge = order.includes("knee_flexion") && !order.includes("hip_hinge");
        const needsHamstring = order.includes("hip_hinge") && !order.includes("knee_flexion");
        if (needsKneeExtension || needsHinge || needsHamstring) return !LEG_PATTERNS.includes(pattern);
    }

    return false;
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

function dayGroup(label?: string) {
    const raw = String(label || "").toLocaleLowerCase("tr-TR");
    if (raw.includes("push")) return "Push";
    if (raw.includes("pull")) return "Pull";
    if (raw.includes("legs")) return "Legs";
    if (raw.includes("upper")) return "Upper";
    if (raw.includes("lower")) return "Lower";
    if (raw.includes("anterior")) return "Anterior";
    if (raw.includes("posterior")) return "Posterior";
    if (raw.includes("torso")) return "Torso";
    if (raw.includes("limbs")) return "Limbs";
    if (raw.includes("full body")) return "FullBody";
    return "Default";
}

const advancedSetSchemes: Record<string, Partial<Record<CoachPatternKey, number>>> = {
    "FB:FullBody": {
        horizontal_adduction: 1, upper_chest: 1, shoulder_extension: 1, shoulder_adduction: 1,
        upper_back: 1, shoulder_abduction: 2, elbow_extension: 1, elbow_flexion: 1,
        knee_extension: 1, leg_press: 1, hip_hinge: 1, knee_flexion: 1,
        spinal_flexion: 2, calf_raise: 1,
    },
    "UL:Upper": {
        horizontal_adduction: 2, upper_chest: 2, shoulder_flexion: 1, shoulder_extension: 1,
        shoulder_adduction: 2, upper_back: 2, shoulder_abduction: 2, elbow_extension: 2,
        elbow_flexion: 2, reverse_curl: 1,
    },
    "UL:Lower": {
        knee_extension: 2, leg_press: 2, hip_hinge: 2, knee_flexion: 1,
        hip_adduction: 1, spinal_flexion: 2, calf_raise: 2,
    },
    "AP:Anterior": {
        horizontal_adduction: 2, upper_chest: 2, shoulder_flexion: 1, shoulder_abduction: 2,
        elbow_extension: 2, knee_extension: 2, leg_press: 2, spinal_flexion: 2,
    },
    "AP:Posterior": {
        shoulder_extension: 1, shoulder_adduction: 2, upper_back: 2, elbow_flexion: 2,
        reverse_curl: 1, hip_hinge: 2, knee_flexion: 1, hip_adduction: 1, calf_raise: 1,
    },
    "TL:Torso": {
        horizontal_adduction: 2, upper_chest: 2, shoulder_flexion: 1, shoulder_extension: 1,
        shoulder_adduction: 2, upper_back: 2, shoulder_abduction: 2,
    },
    "TL:Limbs": {
        elbow_extension: 2, elbow_flexion: 2, reverse_curl: 2, knee_extension: 2,
        leg_press: 2, hip_hinge: 2, knee_flexion: 1, hip_adduction: 1,
        spinal_flexion: 2, calf_raise: 2,
    },
    "PPL:Push": {
        horizontal_adduction: 2, upper_chest: 2, shoulder_flexion: 2, shoulder_abduction: 2, elbow_extension: 2,
    },
    "PPL:Pull": {
        shoulder_extension: 2, shoulder_adduction: 2, upper_back: 2, elbow_flexion: 2, reverse_curl: 2,
    },
    "PPL:Legs": {
        knee_extension: 2, leg_press: 2, hip_hinge: 2, knee_flexion: 2,
        hip_adduction: 2, spinal_flexion: 2, calf_raise: 2,
    },
    "PPLUL:Push": {
        horizontal_adduction: 2, upper_chest: 2, shoulder_flexion: 2, shoulder_abduction: 2, elbow_extension: 2,
    },
    "PPLUL:Pull": {
        shoulder_extension: 2, shoulder_adduction: 2, upper_back: 2, elbow_flexion: 2, reverse_curl: 2,
    },
    "PPLUL:Legs": {
        knee_extension: 2, leg_press: 2, hip_hinge: 2, knee_flexion: 2,
        hip_adduction: 2, spinal_flexion: 2, calf_raise: 2,
    },
    "PPLUL:Upper": {
        horizontal_adduction: 1, upper_chest: 1, shoulder_flexion: 1, shoulder_extension: 1,
        shoulder_adduction: 1, upper_back: 1, shoulder_abduction: 1, elbow_extension: 1,
        elbow_flexion: 1, reverse_curl: 1,
    },
    "PPLUL:Lower": {
        knee_extension: 1, leg_press: 1, hip_hinge: 1, knee_flexion: 1,
        hip_adduction: 1, spinal_flexion: 1, calf_raise: 1,
    },
};

function advancedWorkingSetCount(split: CoachSplitType | undefined, dayLabel: string | undefined, pattern: CoachPatternKey | undefined) {
    if (!split || !pattern) return 1;
    const key = `${split}:${dayGroup(dayLabel)}`;
    return advancedSetSchemes[key]?.[pattern] || 1;
}

export function targetRepsForInput(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus"> & { pattern?: CoachPatternKey; split?: CoachSplitType; dayLabel?: string }): string {
    if (hasSpecificStrengthFocus(input)) return "3-6";
    if (input.pattern === "shoulder_abduction") return input.level === "beginner" ? "12-15" : "4-10";
    if (input.level === "advanced" && input.split === "AP" && dayGroup(input.dayLabel) === "Posterior" && input.pattern === "calf_raise") return "6-10";
    const base = targetReps(input.level);
    if (input.goal === "fat_loss") return base === "8-12" ? "12-15" : "8-12";
    return base;
}

export function targetRirForInput(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus" | "hasPain">): string {
    if (input.hasPain === "yes") return "4-5";
    if (hasSpecificStrengthFocus(input)) return input.level === "beginner" ? "2-3" : "1-2";
    return targetRir(input.level);
}

export function targetRpeForInput(input: Pick<CoachProfileInput, "level" | "hasPain"> & { baseWorkingSets?: number }): string {
    if (input.hasPain === "yes") return (input.baseWorkingSets || 1) <= 1 ? "3-4" : "6";
    if (input.level === "advanced") return "8-10";
    return "6-8";
}

export function makeTargetSets(input: Pick<CoachProfileInput, "level" | "goal" | "strengthFocus" | "hasPain"> & { pattern?: CoachPatternKey; split?: CoachSplitType; dayLabel?: string }) {
    const baseWorkingSets = input.level === "advanced"
        ? advancedWorkingSetCount(input.split, input.dayLabel, input.pattern)
        : workingSetCountForInput(input);
    const workingSets = input.hasPain === "yes" ? Math.max(1, baseWorkingSets - 1) : baseWorkingSets;

    return [
        { targetReps: "3-5", targetRIR: "3-4", isWarmup: true },
        ...Array.from({ length: workingSets }, () => ({
            targetReps: targetRepsForInput(input),
            targetRPE: targetRpeForInput({ level: input.level, hasPain: input.hasPain, baseWorkingSets }),
            targetRIR: targetRirForInput(input),
            targetWeight: input.hasPain === "yes" ? "Min %60 dusur" : undefined,
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

export function normalizeExerciseText(value: string) {
    return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ığüşöç\s]/gi, " ").replace(/\s+/g, " ").trim();
}

export function parseAvoidedExercises(avoidNote?: string, avoidExercises: string[] = []) {
    const noteItems = (avoidNote || "")
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
    return Array.from(new Set([...avoidExercises, ...noteItems].map(normalizeExerciseText).filter(Boolean)));
}

function exerciseSearchTerms(exercise: ExerciseLibraryItem) {
    return [exercise.name, exercise.id, ...exercise.aliases].map(normalizeExerciseText).filter(Boolean);
}

function matchesAvoidedExercise(exercise: ExerciseLibraryItem, avoided: string[]) {
    if (avoided.length === 0) return false;
    const terms = exerciseSearchTerms(exercise);
    return avoided.some((avoidedExercise) => terms.some((term) =>
        term === avoidedExercise ||
        term.includes(avoidedExercise) ||
        avoidedExercise.includes(term),
    ));
}

function inferUnavailableEquipment(note?: string): string[] {
    const raw = String(note || "").toLocaleLowerCase("tr-TR");
    const text = `${raw} ${normalizeExerciseText(note || "")}`;
    if (!text) return [];
    const hasNegative = /(yok|yoktur|bulunmuyor|erisim yok|erişim yok|eksik|olmuyor|istemiyorum|uygun degil|uygun değil|degil|değil)/i.test(text);
    if (!hasNegative) return [];

    const unavailable = new Set<string>();
    const matchers: { key: string; regex: RegExp; also?: string[] }[] = [
        { key: "smith", regex: /(smith)/i },
        { key: "cable", regex: /(cable|kablo)/i },
        { key: "barbell", regex: /(barbell|halter|serbest bar)/i },
        { key: "dumbbell", regex: /(dumbbell|dambıl|dambil|db)/i },
        { key: "machine", regex: /(makine|makineler|machine ekipman|machines)/i, also: ["leg_press"] },
        { key: "leg_press", regex: /(leg press|legpress|bacak press)/i },
        { key: "bench", regex: /(bench|sehpa)/i },
        { key: "rack", regex: /(rack|power rack|squat rack)/i },
        { key: "band", regex: /(band|bant|direnc bandi|diren)/i },
        { key: "bodyweight", regex: /(bodyweight|vucut agirligi|calisthenics)/i },
    ];
    matchers.forEach((item) => {
        if (!item.regex.test(text)) return;
        unavailable.add(item.key);
        item.also?.forEach((also) => unavailable.add(also));
    });
    return Array.from(unavailable);
}

export function inferRequiredMachineType(exercise: Pick<ExerciseLibraryItem, "id" | "name" | "aliases" | "equipment" | "requiredMachineType">): string | undefined {
    if (exercise.requiredMachineType) return exercise.requiredMachineType;
    if (!exercise.equipment.includes("machine") && !exercise.equipment.includes("leg_press")) return undefined;
    const text = normalizeExerciseText([exercise.id, exercise.name, ...(exercise.aliases || [])].join(" "));
    if (/leg press|legpress|bacak press/.test(text)) return "leg_press";
    if (/pec deck|pecdeck|fly|butterfly/.test(text)) return "pec_deck";
    if (/chest press/.test(text)) return "chest_press_machine";
    if (/shoulder press|omuz press/.test(text)) return "shoulder_press_machine";
    if (/lat pulldown|pulldown/.test(text)) return "lat_pulldown";
    if (/row/.test(text)) return "row_machine";
    if (/lateral raise|side raise|yan omuz/.test(text)) return "lateral_raise_machine";
    if (/leg extension|knee extension/.test(text)) return "leg_extension";
    if (/leg curl|hamstring curl/.test(text)) return "leg_curl";
    if (/adductor/.test(text)) return "adductor_machine";
    if (/abductor|glute/.test(text)) return "abductor_glute_machine";
    if (/calf/.test(text)) return "calf_machine";
    if (/triceps/.test(text)) return "triceps_machine";
    if (/curl|biceps/.test(text)) return "curl_machine";
    return "other_machine";
}

export function getMachineTypeOptions() {
    const types = new Set<string>();
    EXERCISE_LIBRARY.forEach((exercise) => {
        const type = inferRequiredMachineType(exercise);
        if (type) types.add(type);
    });
    return Array.from(types).sort();
}

function inferUnavailableMachineTypes(note?: string): string[] {
    const text = normalizeExerciseText(note || "");
    if (!/(yok|yoktur|bulunmuyor|erisim yok|eriÅŸim yok|eksik|olmuyor|istemiyorum)/i.test(text)) return [];
    return getMachineTypeOptions().filter((type) => {
        const readable = type.replace(/_/g, " ");
        return text.includes(type) || text.includes(readable);
    });
}

function inferAllowedEquipment(note?: string): string[] {
    const raw = String(note || "").toLocaleLowerCase("tr-TR");
    const text = `${raw} ${normalizeExerciseText(note || "")}`;
    if (!/(sadece|yalnizca|yalnızca|only)/i.test(text)) return [];
    const allowed = new Set<string>(["bodyweight"]);
    if (/(dumbbell|dambıl|dambil|db)/i.test(text)) {
        allowed.add("dumbbell");
        allowed.add("bench");
    }
    if (/(barbell|halter|serbest bar)/i.test(text)) {
        allowed.add("barbell");
        allowed.add("bench");
    }
    if (/(cable|kablo)/i.test(text)) allowed.add("cable");
    if (/(smith)/i.test(text)) {
        allowed.add("smith");
        allowed.add("bench");
    }
    if (/(machine|makine)/i.test(text)) {
        allowed.add("machine");
        allowed.add("leg_press");
    }
    if (/(leg press|legpress|bacak press)/i.test(text)) allowed.add("leg_press");
    if (/(bench|sehpa)/i.test(text)) allowed.add("bench");
    return Array.from(allowed);
}

export function inferPainContraindicationTags(painNote?: string) {
    const text = normalizeExerciseText(painNote || "");
    const tags = new Set<string>();
    if (/(diz|knee|patella)/i.test(text)) tags.add("knee_pain_sensitive");
    if (/(omuz|shoulder|rotator|kolumu kald|press)/i.test(text)) tags.add("shoulder_pain_sensitive");
    if (/(bel|sirt|sırt|back|deadlift|hinge)/i.test(text)) tags.add("low_back_sensitive");
    if (/(dirsek|elbow)/i.test(text)) tags.add("elbow_pain_sensitive");
    if (/(bilek|wrist)/i.test(text)) tags.add("wrist_pain_sensitive");
    if (/(kalça|kalca|hip)/i.test(text)) tags.add("hip_pain_sensitive");
    if (/(hamstring|arka bacak)/i.test(text)) tags.add("hamstring_sensitive");
    if (/(ayak bileği|ayak bilegi|ankle)/i.test(text)) tags.add("ankle_pain_sensitive");
    return Array.from(tags);
}

function applyEquipmentFilter(candidates: ExerciseLibraryItem[], options?: ExerciseSelectionOptions) {
    if (options?.hasEquipmentLimit !== "yes") return candidates;
    const unavailable = inferUnavailableEquipment(options.equipmentLimitNote);
    const allowed = inferAllowedEquipment(options.equipmentLimitNote);
    const unavailableMachineTypes = inferUnavailableMachineTypes(options.equipmentLimitNote);
    let filtered = candidates;
    if (allowed.length > 0) {
        filtered = filtered.filter((exercise) => exercise.equipment.every((item) => allowed.includes(item)));
    }
    if (unavailable.length > 0) {
        filtered = filtered.filter((exercise) => exercise.equipment.every((item) => !unavailable.includes(item)));
    }
    if (unavailableMachineTypes.length > 0) {
        filtered = filtered.filter((exercise) => {
            const type = inferRequiredMachineType(exercise);
            return !type || !unavailableMachineTypes.includes(type);
        });
    }
    return filtered;
}

function applyPainSafetyFilter(candidates: ExerciseLibraryItem[], options?: ExerciseSelectionOptions) {
    if (!options?.preferPainSafe) return candidates;
    const tags = inferPainContraindicationTags(options.painNote);
    if (tags.length === 0) return candidates;
    const filtered = candidates.filter((exercise) => !exercise.contraindicationTags.some((tag) => tags.includes(tag)));
    return filtered;
}

function exerciseStabilityScore(exercise: ExerciseLibraryItem, level?: CoachLevel) {
    const metadata = getExerciseMetadata(exercise);
    let score = 0;
    if (metadata.stability === "very_stable") score += 12;
    if (metadata.stability === "stable") score += 8;
    if (metadata.stability === "moderate") score += 3;
    if (metadata.skillDemand === "low") score += level === "beginner" ? 4 : 2;
    if (metadata.skillDemand === "high") score -= level === "advanced" ? 1 : 7;
    if (metadata.riskLevel === "high") score -= level === "advanced" ? 2 : 6;
    if (metadata.riskLevel === "medium" && level === "beginner") score -= 2;
    if (exercise.beginnerFriendly) score += level === "beginner" ? 4 : 2;
    if (exercise.difficulty === "advanced") score -= level === "advanced" ? 1 : 8;
    if (exercise.difficulty === "intermediate" && level === "beginner") score -= 2;
    return score;
}

function exerciseGoalScore(exercise: ExerciseLibraryItem, options?: ExerciseSelectionOptions) {
    const metadata = getExerciseMetadata(exercise);
    const tags = new Set(exercise.tags);
    let score = 0;

    if (options?.goal === "strength") {
        if (tags.has("compound")) score += 8;
        if (tags.has("strength")) score += 7;
        if (exercise.equipment.includes("barbell")) score += 4;
        if (exercise.equipment.includes("smith")) score += 2;
        if (options.strengthFocus === "streetlifting") {
            if (exercise.equipment.includes("bodyweight")) score += 10;
            if (tags.has("calisthenics")) score += 8;
            if (/weighted|loaded/i.test(exercise.name)) score += 6;
            if (/pull up|chin up|dip|muscle up/i.test(exercise.name)) score += 5;
        }
    }

    if (options?.goal === "fat_loss") {
        if (metadata.stability === "very_stable") score += 8;
        if (metadata.stability === "stable") score += 5;
        if (metadata.riskLevel === "low") score += 4;
        if (exercise.equipment.includes("machine")) score += 4;
        if (exercise.equipment.includes("cable")) score += 3;
        if (metadata.riskLevel === "high") score -= 6;
        if (metadata.skillDemand === "high") score -= 4;
    }

    return score;
}

function sortExerciseCandidates(candidates: ExerciseLibraryItem[], options?: ExerciseSelectionOptions) {
    return candidates
        .map((exercise, index) => ({ exercise, index }))
        .sort((a, b) => {
            const scoreA = exerciseStabilityScore(a.exercise, options?.level) + exerciseGoalScore(a.exercise, options);
            const scoreB = exerciseStabilityScore(b.exercise, options?.level) + exerciseGoalScore(b.exercise, options);
            const scoreDiff = scoreB - scoreA;
            return scoreDiff || a.index - b.index;
        })
        .map(({ exercise }) => exercise);
}

export function getExercisesForPattern(
    pattern: CoachPatternKey,
    avoidNote?: string,
    avoidExercises: string[] = [],
    options?: ExerciseSelectionOptions,
) {
    const avoided = parseAvoidedExercises(avoidNote, avoidExercises);
    const candidates = EXERCISE_LIBRARY.filter((exercise) => exercise.pattern === pattern);
    const equipmentFiltered = applyEquipmentFilter(candidates, options);
    const painFiltered = applyPainSafetyFilter(equipmentFiltered, options);
    const fallbackPool = options?.allowUnsafeFallback && painFiltered.length === 0
        ? equipmentFiltered
        : painFiltered;
    const sorted = sortExerciseCandidates(fallbackPool, options);
    if (avoided.length === 0) return sorted;
    const filtered = sorted.filter((exercise) => !matchesAvoidedExercise(exercise, avoided));
    return filtered.length > 0 || !options?.allowUnsafeFallback
        ? filtered
        : sorted;
}

export function getAvailableExercises(
    pattern: CoachPatternKey,
    avoidNote?: string,
    avoidExercises: string[] = [],
    options?: ExerciseSelectionOptions,
) {
    return getExercisesForPattern(pattern, avoidNote, avoidExercises, options).map((exercise) => exercise.name);
}

export function resolveCoachExerciseWithAvoidance(
    pattern: CoachPatternKey,
    selectedExercises?: Partial<Record<CoachPatternKey, string>>,
    avoidNote?: string,
    avoidExercises: string[] = [],
    options?: ExerciseSelectionOptions,
) {
    const available = getAvailableExercises(pattern, avoidNote, avoidExercises, options);
    const selected = selectedExercises?.[pattern];
    return selected && available.includes(selected) ? selected : available[0];
}

export function resolveCoachExerciseItemWithAvoidance(
    pattern: CoachPatternKey,
    selectedExercises?: Partial<Record<CoachPatternKey, string>>,
    avoidNote?: string,
    avoidExercises: string[] = [],
    options?: ExerciseSelectionOptions,
) {
    let available = getExercisesForPattern(pattern, avoidNote, avoidExercises, options);
    if (available.length === 0 && options?.allowUnsafeFallback) {
        available = EXERCISE_LIBRARY.filter((exercise) => exercise.pattern === pattern);
    }
    const selected = selectedExercises?.[pattern];
    const selectedExercise = available.find((exercise) =>
        exercise.name === selected ||
        exercise.id === selected ||
        exerciseSearchTerms(exercise).includes(normalizeExerciseText(String(selected || ""))),
    );
    return selectedExercise || available[0];
}

export function inferPainLimitedPatterns(painNote?: string): CoachPatternKey[] {
    const text = normalizeExerciseText(painNote || "");
    if (!text) return [];

    const patterns = new Set<CoachPatternKey>();
    if (/(omuz|shoulder|rotator|kolumu kald|press)/i.test(text)) addPatterns(patterns, SHOULDER_PATTERNS);
    if (/(gogus|gogüs|göğüs|chest|pec|bench)/i.test(text)) addPatterns(patterns, CHEST_PATTERNS);
    if (/(sirt|sırt|back|lat|kanat|trapez|row|pulldown)/i.test(text)) addPatterns(patterns, BACK_PATTERNS);
    if (/(diz|knee|bacak|leg|quad|quadriceps|patella)/i.test(text)) addPatterns(patterns, LEG_PATTERNS);
    if (/(kalca|kalça|hip|glute)/i.test(text)) addPatterns(patterns, ["hip_hinge", "hip_abduction", "hip_adduction"]);
    if (/(hamstring|arka bacak)/i.test(text)) addPatterns(patterns, ["knee_flexion", "hip_hinge"]);
    if (/(ayak bilegi|ayak bileği|ankle|calf|baldir|baldır)/i.test(text)) addPatterns(patterns, ["calf_raise", "leg_press"]);
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

function isMainCompoundExercise(exercise: { targetPattern?: CoachPatternKey; primaryMuscles?: string[]; equipment?: string[]; name?: string }) {
    const pattern = exercise.targetPattern;
    const text = normalizeExerciseText(exercise.name || "");
    return pattern === "horizontal_adduction" ||
        pattern === "upper_chest" ||
        pattern === "leg_press" ||
        pattern === "hip_hinge" ||
        pattern === "shoulder_extension" ||
        pattern === "shoulder_adduction" ||
        /squat|deadlift|bench|press|row|pull up|chin up|dip/.test(text);
}

function isUnilateralExercise(exercise: { name?: string }) {
    const text = normalizeExerciseText(exercise.name || "");
    return /single|one arm|one-arm|one leg|one-leg|unilateral|tek kol|tek bacak|bulgarian|lunge/.test(text);
}

function workingSetTotal(exercise: { targetSets?: { isWarmup?: boolean }[] }) {
    return (exercise.targetSets || []).filter((set) => !set.isWarmup).length || 1;
}

function estimateExerciseSeconds(exercise: { targetSets?: { isWarmup?: boolean }[] }, input: CoachProfileInput) {
    const workSets = workingSetTotal(exercise);
    const setSeconds = workSets * 40;
    const restSeconds = input.goal === "strength"
        ? workSets * 240
        : input.level === "beginner"
            ? workSets * 180
            : workSets * 240;
    return setSeconds + restSeconds;
}

function estimateDaySeconds(exercises: { targetSets?: { isWarmup?: boolean }[] }[], input: CoachProfileInput) {
    return exercises.reduce((total, exercise) => total + estimateExerciseSeconds(exercise, input), 0);
}

function canSupersetExercises(
    first: { targetPattern?: CoachPatternKey; riskAdjusted?: boolean; primaryMuscles?: string[]; name?: string; targetSets?: { isWarmup?: boolean }[] },
    second: { targetPattern?: CoachPatternKey; riskAdjusted?: boolean; primaryMuscles?: string[]; name?: string; targetSets?: { isWarmup?: boolean }[] },
    input: CoachProfileInput,
    forceUnilateral = false,
) {
    if (first.riskAdjusted || second.riskAdjusted) return false;
    if (isMainCompoundExercise(first) || isMainCompoundExercise(second)) return false;
    if (!forceUnilateral && (isUnilateralExercise(first) || isUnilateralExercise(second))) return false;
    const firstMuscles = new Set(first.primaryMuscles || []);
    const sharedMuscle = (second.primaryMuscles || []).some((muscle) => firstMuscles.has(muscle));
    const bothHeavy = workingSetTotal(first) >= 2 && workingSetTotal(second) >= 2;
    if (sharedMuscle && bothHeavy) return false;
    return input.sessionDuration !== "90+";
}

function applySupersetPlan<T extends {
    targetPattern?: CoachPatternKey;
    riskAdjusted?: boolean;
    primaryMuscles?: string[];
    name?: string;
    targetSets?: { isWarmup?: boolean }[];
    supersetGroupId?: string;
    supersetLabel?: string;
    supersetRestHint?: string;
}>(exercises: T[], input: CoachProfileInput, dayIndex: number): T[] {
    if (input.sessionDuration === "90+" || exercises.length < 4) return exercises;
    const targetSeconds = input.sessionDuration === "45-60" ? 60 * 60 : 90 * 60;
    if (input.sessionDuration === "60-90" && estimateDaySeconds(exercises, input) <= targetSeconds) return exercises;

    const next = exercises.map((exercise) => ({ ...exercise }));
    const paired = new Set<number>();
    let group = 1;

    const tryPair = (forceUnilateral: boolean) => {
        for (let right = next.length - 1; right >= 1; right -= 1) {
            if (paired.has(right)) continue;
            for (let left = right - 1; left >= 0; left -= 1) {
                if (paired.has(left)) continue;
                if (!canSupersetExercises(next[left], next[right], input, forceUnilateral)) continue;
                const id = `ss_${dayIndex + 1}_${group}`;
                next[left].supersetGroupId = id;
                next[right].supersetGroupId = id;
                next[left].supersetLabel = `A${group}`;
                next[right].supersetLabel = `A${group}`;
                next[left].supersetRestHint = "Bu iki hareketi arka arkaya uygula, sonra dinlen.";
                next[right].supersetRestHint = "Bu iki hareketi arka arkaya uygula, sonra dinlen.";
                paired.add(left);
                paired.add(right);
                group += 1;
                return true;
            }
        }
        return false;
    };

    while (estimateDaySeconds(next.filter((_, index) => !paired.has(index)), input) > targetSeconds && tryPair(false)) {
        // Keep pairing low priority accessories until the rough duration fits.
    }
    if (input.sessionDuration === "45-60") {
        while (estimateDaySeconds(next.filter((_, index) => !paired.has(index)), input) > targetSeconds && tryPair(true)) {
            // Unilateral pairing is only a last resort for the shortest duration target.
        }
    }
    return next;
}

export function buildCoachProgramData(input: CoachProfileInput) {
    const workoutDays = getWorkoutDays(input);
    const painLimitedPatterns = input.hasPain === "yes" ? inferPainLimitedPatterns(input.painNote) : [];
    const injuryMode = input.hasPain === "yes" && isInjuryNote(input.painNote);
    const shouldExcludePainPatterns = input.hasPain === "yes" && !injuryMode && input.includePainArea === "no";
    const equipmentText = input.hasEquipmentLimit === "yes" && input.equipmentLimitNote?.trim()
        ? input.equipmentLimitNote.trim()
        : "Tam salon erişimi varsayıldı";
    const selectionOptions: ExerciseSelectionOptions = {
        hasEquipmentLimit: input.hasEquipmentLimit,
        equipmentLimitNote: input.equipmentLimitNote,
        painNote: input.painNote,
        preferPainSafe: input.hasPain === "yes" && !injuryMode,
        allowUnsafeFallback: input.hasPain === "yes" && (injuryMode || input.includePainArea !== "no"),
        level: input.level,
        goal: input.goal,
        strengthFocus: input.strengthFocus,
    };

    const days = workoutDays.map((day, dayIndex) => {
        const exercises = day.isRestDay ? [] : day.patterns
            .filter((pattern) => !shouldExcludePainPatterns || !painLimitedPatterns.includes(pattern))
            .map((pattern) => {
                const exercise = resolveCoachExerciseItemWithAvoidance(pattern, input.selectedExercises, input.avoidNote, input.avoidExercises, selectionOptions);
                if (!exercise) return null;
                const riskAdjusted = input.hasPain === "yes" && painLimitedPatterns.includes(pattern);
                const logDisabled = injuryMode && riskAdjusted;
                return {
                    id: makeCoachId("exercise"),
                    exerciseId: exercise.id,
                    name: exercise.name,
                    targetPattern: pattern,
                    targetMuscle: COACH_PATTERN_LABELS[pattern],
                    primaryMuscles: exercise.primaryMuscles,
                    equipment: exercise.equipment,
                    riskAdjusted,
                    logDisabled,
                    logDisabledReason: logDisabled ? "Sakatlık notu aktif: bu bölge programda tutuldu fakat sakatlık geçene kadar loglanamaz." : undefined,
                    painWarning: logDisabled
                        ? "Sakatlık notu aktif: bu hareket programda yer alır ancak sakatlık geçene kadar loglama kapalıdır."
                        : riskAdjusted
                            ? "Ağrı notu aktif: ağırlığı en az %60 düşür, RPE 6 üstüne çıkma ve RIR 4-5 hedefle."
                        : undefined,
                    targetSets: makeTargetSets({
                        level: input.level,
                        goal: input.goal,
                        strengthFocus: input.strengthFocus,
                        hasPain: riskAdjusted ? "yes" : "no",
                        pattern,
                        split: input.split,
                        dayLabel: day.label,
                    }),
                };
            })
            .filter((exercise): exercise is NonNullable<typeof exercise> => Boolean(exercise));

        return {
            label: day.label,
            isRestDay: !!day.isRestDay,
            exercises: applySupersetPlan(exercises, input, dayIndex),
        };
    });

    const supersetCount = days.reduce((total, day) => {
        const groups = new Set((day.exercises || []).map((exercise) => (exercise as any).supersetGroupId).filter(Boolean));
        return total + groups.size;
    }, 0);
    const goalIntro = input.goal === "fat_loss"
        ? "Yağ kaybına destek"
        : input.goal === "strength"
            ? "Güç ve ölçülebilir progress"
            : "Kas kazanımı ve sürdürülebilir progress";

    const levelProgressNote = input.level === "beginner"
        ? "Baslangic seviyesinde agirlik ve tekrarlarin basta daha kolay artabilir. Buna kapilip acele etme; once hareket formunu oturt, sonra form bozulmadan tekrar veya agirlik artir."
        : input.level === "advanced"
            ? "Ileri seviyede progress daha yavas gelir. Ust tekrar sinirina ulasmak, bir onceki antrenmana gore tekrarlarin belirgin artmasi veya agirligin artik hafif gelmesi agirlik artirmayi denemek icin daha dogru sinyallerdir."
            : "Orta seviyede amac uzun vadede hareketlerde agirlik veya tekrar artirmaktir. Bunu her antrenmanda beklemek zorunda degilsin; ust tekrar sinirina form bozulmadan ulasinca kontrollu artis deneyebilirsin.";
    const painGuideSection = input.hasPain === "yes"
        ? [{
            title: injuryMode ? "Agri ve sakatlik notu" : "Agri notu",
            body: injuryMode
                ? "Sakatlik gecici ise programin kendisi degismez. Etkilenen bolge programda gorunur kalir fakat sakatlik gecene kadar ilgili hareketleri loglama. Agri yapan hareketlerden kacin ve gerekiyorsa doktora gorun."
                : "Agri olan bolgede agirligi ciddi dusur, RPE 6 ustune cikma ve RIR 4-5 hedefle. Hareket sirasinda agri veya aci artarsa antrenmani o bolge icin birak ve gerekiyorsa doktora gorun.",
        }]
        : [{
            title: "Agri ve sakatlik",
            body: "Hareket aninda agri veya aci hissedersen o bolge icin antrenmani birak. Agri olmayan bolgeleri calismaya devam edebilirsin; ornegin kolunda sorun varsa bacak gununu aksatmak zorunda degilsin.",
        }];
    const supersetGuideSection = supersetCount > 0
        ? [{
            title: "Dinlenme ve superset",
            body: "Normal setlerde acele etme; kendini hazir hissettiginde sete gir. Genel dinlenme hedefi 3-5 dk civaridir. Programinda superset varsa ilk hareketten sonra cok beklemeden ikinci harekete gec, sonra kisa dinlen ve siradaki superset turune devam et.",
        }]
        : [{
            title: "Dinlenme",
            body: "Set oncesi dinlenme gelisim icin onemlidir. Pump kovalamak icin seti aceleye getirme; calisma setine hazir ve dikkatini harekete vererek gir. Genel dinlenme hedefi 3-5 dk civaridir.",
        }];

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
            injuryMode,
            painLimitedPatterns,
            equipment: equipmentText,
            sessionDuration: input.sessionDuration || "60-90",
            priorityPattern: input.priority || null,
            priorityOrder: input.priorityOrder || [],
            avoidNote: input.avoidNote?.trim() || undefined,
        },
        programIntro: {
            title: "Program rehberi",
            sections: [
                {
                    title: "Programin amaci",
                    body: goalIntro + " icin " + COACH_SPLIT_PATTERNS[input.split].label + " akisi kuruldu. Bu programin amaci uzun vadede sakatligi minimize ederek takip edilebilir ve surdurulebilir bir ilerleme yol haritasi olusturmaktir.",
                },
                {
                    title: "Programi nasil baslatacaksin?",
                    body: "Antrenman oncesinde calisacagin kas gruplarini veya vucudunu isit. Isinmis hissetmiyorsan hareketlerden once isinma setleri yap. Hareketleri program sirasiyla yapman tavsiye edilir ama zorunlu degildir.",
                },
                {
                    title: "Takip ve loglama",
                    body: "Programi ana sayfada basili tutarak takibe alabilirsin. Takibe aldiktan sonra aktif gun ana sayfada gorunur. Calisma setinden sonra kilogram ve tekrarini logla; RPE ve RIR biliyorsan mutlaka ekle.",
                },
                {
                    title: "Seviyene gore odak",
                    body: levelProgressNote,
                },
                {
                    title: "Progress nasil okunur?",
                    body: "Progress bu uygulamanin ana amacidir ama her antrenmanda gelmek zorunda degildir. Ust tekrar sinirina form bozulmadan ulasiyorsan veya ayni agirlik artik daha kolay geliyorsa tekrar ya da agirlik artirmayi deneyebilirsin. Kotu antrenmanlar surecin normal parcasidir.",
                },
                {
                    title: "RPE ve RIR",
                    body: "RPE ve RIR verileri koc analizinin daha dogru calismasina yardim eder. Ne olduklarini bilmiyorsan antrenman loglarken bilgi butonlarindan ogrenip deneye deneye loglamayi aliskanlik haline getir.",
                },
                ...supersetGuideSection,
                ...painGuideSection,
                {
                    title: "Programi ne zaman degistirmelisin?",
                    body: "Sevmedigin veya sana uygun olmayan hareketi program duzenleme ekranindan degistirebilirsin. Fakat sik program degistirmek adaptasyonu en basa sarabilir. Agirlik veya tekrarlar artiyorsa program calisiyor demektir; sabirli kal.",
                },
                {
                    title: "Maksimum verim",
                    body: "Setlerini videoya cekmek, hareket notlari almak ve kablo/sehpa ayari gibi detaylari sabit tutmak progress takibini daha dogru yapar. Calisma setlerine dikkatini vererek gir ve program disina cikmamaya calis.",
                },
            ],
        },
        days,
    };
}
