import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { CARDIO_TYPE_LABELS, formatCardioDuration, getCardioStageDuration, summarizeCardioBlock } from "../utils/cardio";

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

export default function CardioSessionScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [block, setBlock] = useState<CardioBlock | null>(null);
    const [activeStage, setActiveStage] = useState<CardioStage | null>(null);
    const [draft, setDraft] = useState<DraftValues>(emptyDraft);
    const [now, setNow] = useState(Date.now());
    const [saving, setSaving] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        let mounted = true;
        restoreActiveSession().then((saved) => {
            if (!mounted) return;
            setSession(saved);
            const existing = saved?.cardioBlocks?.find((item) => item.id === route.params?.cardioBlockId);
            if (existing) setBlock(existing);
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

    const selectType = (type: CardioType) => {
        setBlock(createBlock(type));
        setDraft(emptyDraft);
    };

    const updateDraft = (key: keyof DraftValues, value: string) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const startStage = (isRest = false) => {
        if (!block) return;
        if (activeStage) {
            setBlock((prev) => prev ? { ...prev, stages: [...prev.stages, closeStage(activeStage)] } : prev);
        }
        setActiveStage(buildStageFromDraft(draft, isRest));
    };

    const pauseStage = () => {
        if (!activeStage) return;
        setBlock((prev) => prev ? { ...prev, stages: [...prev.stages, closeStage(activeStage)] } : prev);
        setActiveStage(null);
    };

    const saveAndReturn = async () => {
        if (!session || !block) return;
        setSaving(true);
        try {
            const completed = finalizeBlock(block, activeStage);
            const otherBlocks = (session.cardioBlocks || []).filter((item) => item.id !== completed.id);
            await saveActiveSession({
                ...session,
                cardioBlocks: [...otherBlocks, completed],
            });
            navigation.goBack();
        } finally {
            setSaving(false);
        }
    };

    const renderTypePicker = () => (
        <View style={styles.typeGrid}>
            {CARDIO_TYPES.map((type) => (
                <TouchableOpacity key={type} style={styles.typeCard} onPress={() => selectType(type)} activeOpacity={0.85}>
                    <Ionicons name={type === "daily_steps" ? "footsteps-outline" : "pulse-outline"} size={22} color={colors.accent} />
                    <Text style={styles.typeText}>{CARDIO_TYPE_LABELS[type]}</Text>
                </TouchableOpacity>
            ))}
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
                        <Text style={styles.inputLabel}>{field.label}</Text>
                        <TextInput
                            value={draft[field.key]}
                            onChangeText={(value) => updateDraft(field.key, value)}
                            placeholder={field.placeholder}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                            style={styles.input}
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
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
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
                                        <Text style={styles.stageTitle}>{stage.isRest ? "Mola" : `Stage ${index + 1}`}</Text>
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
        title: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
        typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
        typeCard: {
            width: "47%",
            minHeight: 96,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.sm,
            justifyContent: "center",
        },
        typeText: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
        summaryCard: {
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: spacing.xs,
        },
        cardTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
        timer: { color: colors.accent, fontSize: 42, fontWeight: fontWeight.bold },
        muted: { color: colors.textSecondary, fontSize: fontSize.sm },
        fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
        inputGroup: { width: "47%", gap: spacing.xs },
        noteGroup: { width: "100%" },
        inputLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
        input: {
            minHeight: 48,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.textPrimary,
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
        stageTitle: { color: colors.textPrimary, fontWeight: fontWeight.semibold },
        stageMeta: { color: colors.textSecondary },
        footer: { gap: spacing.md, marginTop: spacing.md },
    });
}
