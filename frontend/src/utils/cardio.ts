import { CardioBlock, CardioStage, CardioType } from "../types/workout";

export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
    treadmill: "Treadmill",
    bike: "Bisiklet",
    elliptical: "Eliptik",
    outdoor_run: "Serbest kosu",
    daily_steps: "Daily step",
    other: "Diger",
};

export function formatCardioDuration(seconds: number | undefined): string {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

export function getCardioStageDuration(stage: CardioStage, now = Date.now()): number {
    if (stage.endedAt) return Math.max(0, Math.floor(Number(stage.duration) || 0));
    const started = new Date(stage.startedAt).getTime();
    if (!Number.isFinite(started)) return Math.max(0, Math.floor(Number(stage.duration) || 0));
    return Math.max(0, Math.floor((now - started) / 1000));
}

export function summarizeCardioBlock(block: CardioBlock): string {
    const stageDetails = (block.stages || [])
        .map((stage, index) => summarizeCardioStage(stage, index))
        .filter(Boolean);
    const parts = [formatCardioDuration(block.totalDuration)];
    if (block.totalDistance && block.totalDistance > 0) parts.push(`${block.totalDistance.toFixed(2)} km`);
    if (block.totalSteps && block.totalSteps > 0) parts.push(`${Math.round(block.totalSteps)} adim`);
    if (block.totalCalories && block.totalCalories > 0) parts.push(`${Math.round(block.totalCalories)} kcal`);
    if (stageDetails.length > 0) parts.push(stageDetails.join(" / "));
    return parts.join(" | ");
}

export function summarizeCardioStage(stage: CardioStage, index?: number): string {
    const metrics: string[] = [];
    if (stage.speed && stage.speed > 0) metrics.push(`${stage.speed} hiz`);
    if (stage.incline && stage.incline > 0) metrics.push(`${stage.incline} egim`);
    if (stage.resistance && stage.resistance > 0) metrics.push(`${stage.resistance} direnc`);
    if (stage.rpm && stage.rpm > 0) metrics.push(`${stage.rpm} RPM`);
    if (stage.distance && stage.distance > 0) metrics.push(`${stage.distance} km`);
    if (stage.steps && stage.steps > 0) metrics.push(`${Math.round(stage.steps)} adim`);
    if (stage.calories && stage.calories > 0) metrics.push(`${Math.round(stage.calories)} kcal`);
    if (metrics.length === 0) return "";
    const prefix = stage.isRest ? "Mola" : index !== undefined ? `S${index + 1}` : "Stage";
    return `${prefix}: ${metrics.join(", ")}`;
}

export function summarizeCardioBlocks(blocks: CardioBlock[] | undefined): string {
    const valid = (blocks || []).filter((block) => block.totalDuration > 0 || block.totalDistance || block.totalSteps || block.totalCalories);
    if (valid.length === 0) return "";
    const totalDuration = valid.reduce((sum, block) => sum + Math.max(0, Number(block.totalDuration) || 0), 0);
    const totalDistance = valid.reduce((sum, block) => sum + Math.max(0, Number(block.totalDistance) || 0), 0);
    const totalSteps = valid.reduce((sum, block) => sum + Math.max(0, Number(block.totalSteps) || 0), 0);
    const totalCalories = valid.reduce((sum, block) => sum + Math.max(0, Number(block.totalCalories) || 0), 0);
    const parts = [`${valid.length} kardiyo`, formatCardioDuration(totalDuration)];
    if (totalDistance > 0) parts.push(`${totalDistance.toFixed(2)} km`);
    if (totalSteps > 0) parts.push(`${Math.round(totalSteps)} adim`);
    if (totalCalories > 0) parts.push(`${Math.round(totalCalories)} kcal`);
    return parts.join(" | ");
}
