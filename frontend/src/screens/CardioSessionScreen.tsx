import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Modal,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AccentButton from "../components/AccentButton";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { restoreActiveSession, saveActiveSession } from "../services/syncService";
import { CardioBlock, CardioStage, CardioType, WorkoutSession } from "../types/workout";
import { CARDIO_TYPE_LABELS, formatCardioDuration, getCardioStageDuration, summarizeCardioBlock, summarizeCardioStage } from "../utils/cardio";

type Route = RouteProp<RootStackParamList, "CardioSession">;

const CARDIO_TYPES: CardioType[] = ["treadmill", "bike", "elliptical", "outdoor_run", "daily_steps", "other"];

function uid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function toNumber(value: string): number | undefined {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function createBlock(type: CardioType): CardioBlock {
    return {
        id: uid(),
        type,
        title: CARDIO_TYPE_LABELS[type],
        startedAt: new Date().toISOString(),
        totalDuration: 0,
        stages: [],
    };
}

function buildStageFromDraft(draft: DraftValues, isRest = false): CardioStage {
    return {
        id: uid(),
        startedAt: new Date().toISOString(),
        duration: 0,
        speed: toNumber(draft.speed),
        incline: toNumber(draft.incline),
        resistance: toNumber(draft.resistance),
        rpm: toNumber(draft.rpm),
        distance: toNumber(draft.distance),
        steps: toNumber(draft.steps),
        calories: toNumber(draft.calories),
        note: draft.note.trim() || undefined,
        isRest,
    };
}

function applyDraftToStage(stage: CardioStage, draft: DraftValues): CardioStage {
    return {
        ...stage,
        speed: toNumber(draft.speed),
        incline: toNumber(draft.incline),
        resistance: toNumber(draft.resistance),
        rpm: toNumber(draft.rpm),
        distance: toNumber(draft.distance),
        steps: toNumber(draft.steps),
        calories: toNumber(draft.calories),
        note: draft.note.trim() || undefined,
    };
}

function draftFromStage(stage?: CardioStage | null): DraftValues {
    if (!stage) return emptyDraft;
    return {
        speed: stage.speed ? String(stage.speed) : "",
        incline: stage.incline ? String(stage.incline) : "",
        resistance: stage.resistance ? String(stage.resistance) : "",
        rpm: stage.rpm ? String(stage.rpm) : "",
        distance: stage.distance ? String(stage.distance) : "",
        steps: stage.steps ? String(stage.steps) : "",
        calories: stage.calories ? String(stage.calories) : "",
        note: stage.note || "",
    };
}

function metricChanged(stage: CardioStage, draft: DraftValues): boolean {
    const keys: (keyof DraftValues)[] = ["speed", "incline", "resistance", "rpm", "distance", "steps"];
    return keys.some((key) => {
        const current = (stage as any)[key];
        const next = toNumber(draft[key]);
        return (current || undefined) !== (next || undefined);
    });
}

function closeStage(stage: CardioStage, now = Date.now()): CardioStage {
    const endedAt = new Date(now).toISOString();
    return {
        ...stage,
        endedAt,
        duration: getCardioStageDuration(stage, now),
    };
}

function finalizeBlock(block: CardioBlock, activeStage: CardioStage | null): CardioBlock {
    const stages = activeStage ? [...block.stages, closeStage(activeStage)] : block.stages;
    const totalDuration = stages.reduce((sum, stage) => sum + getCardioStageDuration(stage), 0);
    const totalDistance = stages.reduce((sum, stage) => sum + (Number(stage.distance) || 0), 0);
    const totalSteps = stages.reduce((sum, stage) => sum + (Number(stage.steps) || 0), 0);
    const totalCalories = stages.reduce((sum, stage) => sum + (Number(stage.calories) || 0), 0);

    return {
        ...block,
        stages,
        completedAt: new Date().toISOString(),
        totalDuration,
        totalDistance: totalDistance > 0 ? totalDistance : undefined,
        totalSteps: totalSteps > 0 ? totalSteps : undefined,
        totalCalories: totalCalories > 0 ? totalCalories : undefined,
    };
}

interface DraftValues {
    speed: string;
    incline: string;
    resistance: string;
    rpm: string;
    distance: string;
    steps: string;
    calories: string;
    note: string;
}

const emptyDraft: DraftValues = {
    speed: "",
    incline: "",
    resistance: "",
    rpm: "",
    distance: "",
    steps: "",
    calories: "",
    note: "",
};

const FIELD_HELP: Partial<Record<keyof DraftValues, string>> = {
    speed: "Koşu bandı veya dış koşu hızını km/s olarak yazabilirsin.",
    incline: "Koşu bandı eğimini yüzde olarak tutar. Örn. 4 eğim.",
    resistance: "Bisiklet veya eliptikte cihazın direnç seviyesidir.",
    rpm: "Dakikadaki pedal devir sayısıdır. Tempo takibi için kullanılır.",
    distance: "Toplam mesafeyi kilometre olarak yaz.",
    steps: "Günlük adım veya yürüyüş hedefini kaydetmek için kullanılır.",
    calories: "Cihazın gösterdiği yaklaşık kalori değeridir.",
};

export default function CardioSessionScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [block, setBlock] = useState<CardioBlock | null>(null);
    const [activeStage, setActiveStage] = useState<CardioStage | null>(null);
    const [draft, setDraft] = useState<DraftValues>(emptyDraft);
    const [helpText, setHelpText] = useState<{ title: string; message: string } | null>(null);
    const [now, setNow] = useState(Date.now());
    const [saving, setSaving] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        let mounted = true;
        restoreActiveSession().then((saved) => {
            if (!mounted) return;
            setSession(saved);
            const existing = saved?.cardioBlocks?.find((item) => item.id === route.params?.cardioBlockId);
            const activeBlock = saved?.activeCardioBlockId
                ? saved?.cardioBlocks?.find((item) => item.id === saved.activeCardioBlockId)
                : undefined;
            if (existing) setBlock(existing);
            else if (activeBlock) setBlock(activeBlock);
            if (saved?.activeCardioStage) {
                setActiveStage(saved.activeCardioStage);
                setDraft(draftFromStage(saved.activeCardioStage));
            }
        });
        return () => {
            mounted = false;
        };
    }, [route.params?.cardioBlockId]);

    useEffect(() => {
        if (!activeStage) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            return;
        }
        intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
        };
    }, [activeStage]);

    const activeDuration = activeStage ? getCardioStageDuration(activeStage, now) : 0;
    const totalPreview = (block?.stages || []).reduce((sum, stage) => sum + getCardioStageDuration(stage), 0) + activeDuration;

    const persistCardioState = async (nextBlock: CardioBlock, nextActiveStage: CardioStage | null) => {
        if (!session) return;
        const otherBlocks = (session.cardioBlocks || []).filter((item) => item.id !== nextBlock.id);
        const nextSession = {
            ...session,
            cardioBlocks: [...otherBlocks, nextBlock],
            activeCardioBlockId: nextActiveStage ? nextBlock.id : undefined,
            activeCardioStage: nextActiveStage || undefined,
        };
        setSession(nextSession);
        await saveActiveSession(nextSession);
    };

    const selectType = async (type: CardioType) => {
        const nextBlock = createBlock(type);
        setBlock(nextBlock);
        setDraft(emptyDraft);
        await persistCardioState(nextBlock, null);
    };

    const updateDraft = (key: keyof DraftValues, value: string) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const autoAdvanceStageIfMetricsChanged = async () => {
        if (!block || !activeStage || !metricChanged(activeStage, draft)) return;
        const closedStage = closeStage(activeStage);
        const nextBlock = { ...block, stages: [...block.stages, closedStage] };
        const nextStage = buildStageFromDraft(draft, false);
        setBlock(nextBlock);
        setActiveStage(nextStage);
        await persistCardioState(nextBlock, nextStage);
    };

    const startStage = async (isRest = false) => {
        if (!block) return;
        let nextBlock = block;
        if (activeStage) {
            nextBlock = { ...block, stages: [...block.stages, closeStage(applyDraftToStage(activeStage, draft))] };
            setBlock(nextBlock);
        }
        const nextStage = buildStageFromDraft(draft, isRest);
        setActiveStage(nextStage);
        await persistCardioState(nextBlock, nextStage);
    };

    const pauseStage = async () => {
        if (!block || !activeStage) return;
        const nextBlock = { ...block, stages: [...block.stages, closeStage(applyDraftToStage(activeStage, draft))] };
        setBlock(nextBlock);
        setActiveStage(null);
        await persistCardioState(nextBlock, null);
    };

    const saveAndReturn = async () => {
        if (!session || !block) return;
        setSaving(true);
        try {
            const completed = finalizeBlock(block, activeStage ? applyDraftToStage(activeStage, draft) : null);
            const otherBlocks = (session.cardioBlocks || []).filter((item) => item.id !== completed.id);
            await saveActiveSession({
                ...session,
                cardioBlocks: [...otherBlocks, completed],
                activeCardioBlockId: undefined,
                activeCardioStage: undefined,
            });
            navigation.goBack();
        } finally {
            setSaving(false);
        }
    };

    const renderTypePicker = () => (
        <View style={styles.typeGrid}>
            {CARDIO_TYPES.map((type) => {
                const icon = type === "daily_steps" ? "footsteps-outline"
                    : type === "bike" ? "bicycle-outline"
                        : type === "treadmill" || type === "outdoor_run" ? "walk-outline"
                            : "pulse-outline";
                return (
                    <TouchableOpacity key={type} style={styles.typeCard} onPress={() => selectType(type)} activeOpacity={0.85}>
                        <View style={styles.typeIcon}>
                            <Ionicons name={icon as any} size={24} color={colors.accent} />
                        </View>
                        <Text style={styles.typeText}>{CARDIO_TYPE_LABELS[type]}</Text>
                        <Text style={styles.typeHint}>
                            {type === "treadmill" ? "Hız, eğim, stage"
                                : type === "daily_steps" ? "Adım ve kalori"
                                    : type === "bike" || type === "elliptical" ? "Direnç, RPM, süre"
                                        : "Mesafe, süre, not"}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderDraftFields = () => {
        if (!block) return null;
        const fields: { key: keyof DraftValues; label: string; placeholder: string }[] = [];
        if (block.type === "treadmill") {
            fields.push({ key: "speed", label: "Hiz", placeholder: "12" }, { key: "incline", label: "Eğim", placeholder: "4" });
        }
        if (block.type === "bike" || block.type === "elliptical") {
            fields.push({ key: "resistance", label: "Direnç", placeholder: "8" }, { key: "rpm", label: "RPM", placeholder: "70" });
        }
        if (block.type === "outdoor_run") {
            fields.push({ key: "distance", label: "Mesafe km", placeholder: "3.5" }, { key: "speed", label: "Ortalama hiz", placeholder: "10" });
        }
        if (block.type === "daily_steps") {
            fields.push({ key: "steps", label: "Adim", placeholder: "8000" });
        }
        if (block.type === "other") {
            fields.push({ key: "distance", label: "Mesafe km", placeholder: "2" });
        }
        fields.push({ key: "calories", label: "Kalori", placeholder: "120" });

        return (
            <View style={styles.fieldGrid}>
                {fields.map((field) => (
                    <View key={field.key} style={styles.inputGroup}>
                        <View style={styles.inputLabelRow}>
                            <Text style={styles.inputLabel}>{field.label}</Text>
                            {FIELD_HELP[field.key] ? (
                                <TouchableOpacity
                                    onPress={() => setHelpText({ title: field.label, message: FIELD_HELP[field.key] || "" })}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <TextInput
                            value={draft[field.key]}
                            onChangeText={(value) => updateDraft(field.key, value)}
                            placeholder={field.placeholder}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                            style={styles.input}
                            onBlur={autoAdvanceStageIfMetricsChanged}
                        />
                    </View>
                ))}
                <View style={[styles.inputGroup, styles.noteGroup]}>
                    <Text style={styles.inputLabel}>Stage notu</Text>
                    <TextInput
                        value={draft.note}
                        onChangeText={(value) => updateDraft("note", value)}
                        placeholder="Tempo, his, mola..."
                        placeholderTextColor={colors.textMuted}
                        style={[styles.input, styles.noteInput]}
                    />
                </View>
            </View>
        );
    };

    if (!session) {
        return (
            <View style={styles.center}>
                <Text style={styles.title}>Aktif antrenman bulunamadi</Text>
                <AccentButton title="Geri Don" onPress={() => navigation.goBack()} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={async () => {
                            if (block) await persistCardioState(block, activeStage ? applyDraftToStage(activeStage, draft) : null);
                            navigation.goBack();
                        }}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.eyebrow}>Antrenmana bagli</Text>
                        <Text style={styles.title}>Kardiyo logu</Text>
                    </View>
                </View>

                {!block ? renderTypePicker() : (
                    <>
                        <View style={styles.summaryCard}>
                            <Text style={styles.cardTitle}>{block.title}</Text>
                            <Text style={styles.timer}>{formatCardioDuration(totalPreview)}</Text>
                            <Text style={styles.muted}>
                                {block.stages.length} stage kaydedildi{activeStage ? " | aktif stage suruyor" : ""}
                            </Text>
                        </View>

                        {renderDraftFields()}

                        <View style={styles.actions}>
                            {!activeStage ? (
                                <AccentButton title="Stage Baslat" onPress={() => startStage(false)} />
                            ) : (
                                <AccentButton title="Duraklat" onPress={pauseStage} />
                            )}
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => startStage(true)}>
                                <Ionicons name="pause-circle-outline" size={18} color={colors.accent} />
                                <Text style={styles.secondaryText}>Mola Stage</Text>
                            </TouchableOpacity>
                        </View>

                        {block.stages.length > 0 ? (
                            <View style={styles.stageList}>
                                {block.stages.map((stage, index) => (
                                    <View key={stage.id} style={styles.stageRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stageTitle}>{stage.isRest ? "Mola" : `Stage ${index + 1}`}</Text>
                                            <Text style={styles.stageMetric}>{summarizeCardioStage(stage, index)}</Text>
                                            {stage.note ? <Text style={styles.stageNote}>{stage.note}</Text> : null}
                                        </View>
                                        <Text style={styles.stageMeta}>{formatCardioDuration(stage.duration)}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        <View style={styles.footer}>
                            <Text style={styles.muted}>
                                {summarizeCardioBlock(finalizeBlock(block, activeStage))}
                            </Text>
                            <AccentButton
                                title="Kardiyoyu Kaydet"
                                onPress={saveAndReturn}
                                loading={saving}
                                disabled={!activeStage && block.stages.length === 0}
                            />
                        </View>
                    </>
                )}
            </ScrollView>
            <Modal visible={!!helpText} transparent animationType="fade" onRequestClose={() => setHelpText(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.helpModal}>
                        <Text style={styles.helpTitle}>{helpText?.title}</Text>
                        <Text style={styles.helpMessage}>{helpText?.message}</Text>
                        <AccentButton title="Tamam" onPress={() => setHelpText(null)} size="md" />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

function createStyles(colors: any) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        center: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.md,
            backgroundColor: colors.background,
        },
        content: { padding: spacing.lg, paddingBottom: spacing.xxxl * 2, gap: spacing.lg },
        header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
        iconBtn: {
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
        },
        eyebrow: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
        title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
        typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
        typeCard: {
            width: "47%",
            minHeight: 126,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
            justifyContent: "space-between",
        },
        typeIcon: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentMuted,
        },
        typeText: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
        typeHint: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 16 },
        summaryCard: {
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.xs,
        },
        cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
        timer: { color: colors.accent, fontSize: 42, fontWeight: fontWeight.bold },
        muted: { color: colors.textSecondary, fontSize: fontSize.sm },
        fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
        inputGroup: { width: "47%", gap: spacing.xs },
        noteGroup: { width: "100%" },
        inputLabelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
        inputLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
        input: {
            minHeight: 48,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.text,
            fontSize: fontSize.md,
        },
        noteInput: { minHeight: 56 },
        actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
        secondaryBtn: {
            minHeight: 48,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
        },
        secondaryText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
        stageList: { gap: spacing.sm },
        stageRow: {
            padding: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
        },
        stageTitle: { color: colors.text, fontWeight: fontWeight.semibold },
        stageMetric: { color: colors.accent, fontSize: fontSize.sm, marginTop: 2 },
        stageNote: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
        stageMeta: { color: colors.textSecondary },
        footer: { gap: spacing.md, marginTop: spacing.md },
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
        },
        helpModal: {
            width: "100%",
            maxWidth: 420,
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.md,
        },
        helpTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
        helpMessage: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
    });
}
