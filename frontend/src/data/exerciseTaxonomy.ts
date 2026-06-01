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
    {
        key: "core",
        label: "Core / abs",
        beginnerLabel: "Karın",
        region: "core",
        patterns: ["spinal_flexion"],
        subGroups: [{ key: "abs", label: "Abs", patterns: ["spinal_flexion"] }],
        info: "Omurgayı kontrollü fleksiyona getiren hareketler karın kaslarını hedefler.",
    },
];

export function groupForPattern(pattern?: string): MuscleGroup | undefined {
    return MUSCLE_GROUPS.find((group) => group.patterns.includes(String(pattern || "")));
}

export function groupForExercise(exercise: Pick<ExerciseLibraryItem, "pattern">): MuscleGroup | undefined {
    return groupForPattern(exercise.pattern);
}

export function subGroupForPattern(pattern?: string): MuscleGroup["subGroups"][number] | undefined {
    const value = String(pattern || "");
    return MUSCLE_GROUPS.flatMap((group) => group.subGroups).find((subGroup) => subGroup.patterns.includes(value));
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

export function displayExerciseTarget(exercise: Pick<ExerciseLibraryItem, "pattern">): string {
    const group = groupForExercise(exercise);
    const subGroup = subGroupForPattern(exercise.pattern);
    if (!group && !subGroup) return "Genel";
    if (!subGroup) return group?.beginnerLabel || "Genel";
    return `${group?.beginnerLabel || "Genel"} / ${subGroup.label}`;
}

export function relatedPatternsForExercise(exercise: Pick<ExerciseLibraryItem, "pattern">): string[] {
    const group = groupForExercise(exercise);
    if (!group) return [];
    return group.patterns.filter((pattern) => pattern !== exercise.pattern);
}

export function patternPurpose(pattern?: string): string {
    const labels: Record<string, string> = {
        horizontal_adduction: "Göğsü yatay itme/fly hattında hedefler; press ve fly varyasyonları bu gruba girer.",
        upper_chest: "Üst göğüs odağı için omuz fleksiyonu eklenen press/fly varyasyonlarını kapsar.",
        shoulder_flexion: "Ön omuz ve dikey itiş hattını takip eder.",
        shoulder_abduction: "Yan omuz odağıdır; omuzu yana kaldırma hareketleri bu paterndedir.",
        shoulder_adduction: "Alt kanat odağıdır; kolu yukarıdan gövdeye yaklaştıran çekişleri kapsar.",
        shoulder_extension: "Üst kanat odağıdır; dirseği gövdeye yakın aşağı/arkaya çeken hareketleri kapsar.",
        upper_back: "Üst sırt, orta trapez ve arka omuz desteği için yatay çekiş hattıdır.",
        elbow_extension: "Triceps için dirsek açma hareketlerini kapsar.",
        elbow_flexion: "Biceps için dirsek bükme hareketlerini kapsar.",
        reverse_curl: "Brachialis ve ön kol desteği için pronasyonlu curl varyasyonlarını kapsar.",
        knee_extension: "Rectus femoris ve quadriceps izolasyonu için diz açma hattıdır.",
        leg_press: "Vastus/quadriceps ağırlıklı squat veya leg press hattıdır.",
        hip_hinge: "Hamstring ve glute odağı için kalçadan menteşe hareketlerini kapsar.",
        knee_flexion: "Hamstring izolasyonu için diz bükme hareketlerini kapsar.",
        hip_adduction: "İç bacak/adductor odağıdır.",
        spinal_flexion: "Karın kasları için omurgayı kontrollü fleksiyona getiren hareketlerdir.",
        calf_raise: "Baldır için plantar fleksiyon hareketlerini kapsar.",
    };
    return labels[String(pattern || "")] || "Bu hareket SmartProgress patern eşlemesine göre takip edilir.";
}
