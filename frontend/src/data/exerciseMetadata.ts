import {
    type ExerciseGoalFit,
    type ExerciseLibraryItem,
    type ExerciseMovementFamily,
    type ExerciseRiskLevel,
    type ExerciseSkillDemand,
    type ExerciseStability,
} from "./exerciseLibrary";

const PATTERN_FAMILY: Record<string, ExerciseMovementFamily> = {
    horizontal_adduction: "press",
    upper_chest: "press",
    shoulder_flexion: "press",
    shoulder_extension: "pulldown",
    shoulder_adduction: "pulldown",
    upper_back: "row",
    rear_delt: "raise",
    trapezius: "raise",
    rotator_cuff: "extension",
    shoulder_abduction: "raise",
    elbow_extension: "extension",
    elbow_flexion: "curl",
    reverse_curl: "curl",
    knee_extension: "extension",
    leg_press: "squat_pattern",
    hip_hinge: "hinge",
    hip_abduction: "hip_isolation",
    knee_flexion: "extension",
    hip_adduction: "hip_isolation",
    spinal_flexion: "core",
    spinal_extension: "core",
    spinal_rotation: "rotation",
    calf_raise: "calf",
};

export function inferMovementFamily(exercise: Pick<ExerciseLibraryItem, "pattern" | "tags">): ExerciseMovementFamily {
    if (exercise.tags.includes("fly")) return "fly";
    if (exercise.tags.includes("row")) return "row";
    if (exercise.tags.includes("rotation")) return "rotation";
    return PATTERN_FAMILY[exercise.pattern] || "other";
}

export function inferReplacementGroup(exercise: Pick<ExerciseLibraryItem, "pattern" | "tags">): string {
    return `${exercise.pattern}:${inferMovementFamily(exercise)}`;
}

export function inferStability(exercise: Pick<ExerciseLibraryItem, "equipment" | "tags">): ExerciseStability {
    if (exercise.equipment.includes("machine") || exercise.tags.includes("guided")) return "very_stable";
    if (exercise.equipment.includes("cable") || exercise.equipment.includes("smith") || exercise.tags.includes("stable")) return "stable";
    if (exercise.equipment.includes("dumbbell") || exercise.equipment.includes("bodyweight")) return "moderate";
    return "unstable";
}

export function inferSkillDemand(exercise: Pick<ExerciseLibraryItem, "difficulty" | "tags">): ExerciseSkillDemand {
    if (exercise.difficulty === "advanced" || exercise.tags.includes("advanced")) return "high";
    if (exercise.difficulty === "intermediate" || exercise.tags.includes("free_weight")) return "medium";
    return "low";
}

export function inferRiskLevel(exercise: Pick<ExerciseLibraryItem, "difficulty" | "contraindicationTags" | "tags">): ExerciseRiskLevel {
    if (exercise.difficulty === "advanced" || exercise.contraindicationTags.length >= 2 || exercise.tags.includes("advanced")) return "high";
    if (exercise.difficulty === "intermediate" || exercise.contraindicationTags.length === 1) return "medium";
    return "low";
}

export function inferGoalFit(exercise: Pick<ExerciseLibraryItem, "tags" | "equipment" | "difficulty">): ExerciseGoalFit[] {
    const goals = new Set<ExerciseGoalFit>(["hypertrophy"]);
    if (exercise.tags.includes("strength") || exercise.tags.includes("compound")) goals.add("strength");
    if (exercise.tags.includes("shoulder_health") || exercise.tags.includes("rotator_cuff")) goals.add("rehab");
    if (exercise.tags.includes("stable") || exercise.tags.includes("guided") || exercise.equipment.includes("machine")) goals.add("fatigue_management");
    if (exercise.difficulty === "advanced") goals.add("skill");
    return Array.from(goals);
}

export function getExerciseMetadata(exercise: ExerciseLibraryItem) {
    return {
        movementFamily: exercise.movementFamily || inferMovementFamily(exercise),
        replacementGroup: exercise.replacementGroup || inferReplacementGroup(exercise),
        stability: exercise.stability || inferStability(exercise),
        skillDemand: exercise.skillDemand || inferSkillDemand(exercise),
        riskLevel: exercise.riskLevel || inferRiskLevel(exercise),
        goalFit: exercise.goalFit || inferGoalFit(exercise),
    };
}

export function stabilityLabel(value: ExerciseStability) {
    if (value === "very_stable") return "Çok stabil";
    if (value === "stable") return "Stabil";
    if (value === "moderate") return "Orta stabilite";
    return "Teknik hassas";
}

export function skillDemandLabel(value: ExerciseSkillDemand) {
    if (value === "low") return "Düşük teknik";
    if (value === "medium") return "Orta teknik";
    return "Yüksek teknik";
}

export function riskLevelLabel(value: ExerciseRiskLevel) {
    if (value === "low") return "Düşük risk";
    if (value === "medium") return "Orta risk";
    return "Yüksek dikkat";
}
