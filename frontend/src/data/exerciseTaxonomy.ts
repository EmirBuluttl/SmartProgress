import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "./exerciseLibrary";

export type MuscleRegion = "upper" | "lower" | "core";

export type MuscleGroup = {
    key: string;
    label: string;
    beginnerLabel: string;
    region: MuscleRegion;
    patterns: string[];
    subGroups: { key: string; label: string; patterns: string[] }[];
    info: string;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
    {
        key: "chest",
        label: "Göğüs",
        beginnerLabel: "Göğüs",
        region: "upper",
        patterns: ["horizontal_adduction", "upper_chest"],
        subGroups: [
            { key: "mid_chest", label: "Orta/alt göğüs", patterns: ["horizontal_adduction"] },
            { key: "upper_chest", label: "Üst göğüs", patterns: ["upper_chest"] },
        ],
        info: "İtme ve fly varyasyonlarında ana hedef göğüs kaslarıdır.",
    },
    {
        key: "shoulders",
        label: "Omuz",
        beginnerLabel: "Omuz",
        region: "upper",
        patterns: ["shoulder_abduction", "shoulder_flexion", "rear_delt"],
        subGroups: [
            { key: "side_delt", label: "Yan omuz", patterns: ["shoulder_abduction"] },
            { key: "front_delt", label: "Ön omuz", patterns: ["shoulder_flexion"] },
            { key: "rear_delt", label: "Arka omuz", patterns: ["rear_delt", "upper_back"] },
        ],
        info: "Omuz başlığı yan, ön ve arka omuz alt odaklarına ayrılabilir.",
    },
    {
        key: "back",
        label: "Sırt / kanat",
        beginnerLabel: "Sırt",
        region: "upper",
        patterns: ["shoulder_adduction", "shoulder_extension", "upper_back"],
        subGroups: [
            { key: "lats_lower", label: "Alt kanat", patterns: ["shoulder_adduction"] },
            { key: "lats_upper", label: "Üst kanat", patterns: ["shoulder_extension"] },
            { key: "upper_back", label: "Üst sırt", patterns: ["upper_back"] },
        ],
        info: "Kanat ve üst sırt hareketleri çekiş açısına göre ayrılır.",
    },
    {
        key: "arms",
        label: "Kol",
        beginnerLabel: "Kol",
        region: "upper",
        patterns: ["elbow_flexion", "elbow_extension", "brachialis"],
        subGroups: [
            { key: "biceps", label: "Biceps", patterns: ["elbow_flexion"] },
            { key: "triceps", label: "Triceps", patterns: ["elbow_extension"] },
            { key: "brachialis", label: "Brachialis / ön kol desteği", patterns: ["brachialis"] },
        ],
        info: "Kol hareketleri dirsek fleksiyon/ekstansiyon mantığıyla takip edilir.",
    },
    {
        key: "quads",
        label: "Quadriceps",
        beginnerLabel: "Ön bacak",
        region: "lower",
        patterns: ["leg_press", "knee_extension"],
        subGroups: [
            { key: "vastus", label: "Vastuslar", patterns: ["leg_press"] },
            { key: "rectus_femoris", label: "Rectus femoris", patterns: ["knee_extension"] },
        ],
        info: "Diz ekstansiyonu ve squat/leg press paternleri ön bacağı öne çıkarır.",
    },
    {
        key: "posterior_leg",
        label: "Hamstring / glute",
        beginnerLabel: "Arka bacak / kalça",
        region: "lower",
        patterns: ["hip_hinge", "knee_flexion", "hip_abduction"],
        subGroups: [
            { key: "hamstring", label: "Hamstring", patterns: ["hip_hinge", "knee_flexion"] },
            { key: "glute", label: "Glute / kalça", patterns: ["hip_hinge", "hip_abduction"] },
        ],
        info: "Hinge ve knee flexion hareketleri arka zinciri hedefler.",
    },
    {
        key: "adductor",
        label: "Adductor",
        beginnerLabel: "İç bacak",
        region: "lower",
        patterns: ["hip_adduction"],
        subGroups: [{ key: "adductor", label: "İç bacak", patterns: ["hip_adduction"] }],
        info: "Kalçayı içe kapatma hareketleri iç bacak/adductor odaklıdır.",
    },
    {
        key: "calves",
        label: "Calf",
        beginnerLabel: "Baldır",
        region: "lower",
        patterns: ["calf_raise"],
        subGroups: [{ key: "calves", label: "Gastrocnemius / soleus", patterns: ["calf_raise"] }],
        info: "Plantar flexion hareketleri baldır kaslarını öne çıkarır.",
    },
];

export function groupForPattern(pattern?: string): MuscleGroup | undefined {
    return MUSCLE_GROUPS.find((group) => group.patterns.includes(String(pattern || "")));
}

export function groupForExercise(exercise: Pick<ExerciseLibraryItem, "pattern">): MuscleGroup | undefined {
    return groupForPattern(exercise.pattern);
}

export function groupForExerciseName(name: unknown): MuscleGroup | undefined {
    const normalized = String(name || "").trim().toLocaleLowerCase("tr-TR");
    if (!normalized) return undefined;
    const exercise = EXERCISE_LIBRARY.find((item) => {
        const names = [item.name, ...item.aliases].map((value) => value.toLocaleLowerCase("tr-TR"));
        return names.includes(normalized);
    });
    return exercise ? groupForExercise(exercise) : undefined;
}

export function displayMuscleGroup(exercise: Pick<ExerciseLibraryItem, "pattern">, beginner = true): string {
    const group = groupForExercise(exercise);
    if (!group) return "Genel";
    return beginner ? group.beginnerLabel : group.label;
}
