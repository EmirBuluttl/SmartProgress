// ─────────────────────────────────────────────
// Program Create Screen — Cycle Builder
// Frekans seçimi + çok günlü program oluşturma
// ─────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    ScrollView,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { programApi, parseApiError } from "../services/api";
import type { TargetExercise, TargetSet } from "../types/workout";
import {
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
} from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import PrivacyModal from "../components/PrivacyModal";
import ActionConfirmModal from "../components/ActionConfirmModal";
import NoticeModal from "../components/NoticeModal";
import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "../data/exerciseLibrary";

// ─── Helpers ─────────────────────────────────

const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6, 7];
const MAX_PROGRAM_DAYS = 7;
const SPLIT_OPTIONS = [
    { key: "PPL", label: "PPL", desc: "Push Pull Legs" },
    { key: "AP", label: "AP", desc: "Anterior Posterior" },
    { key: "UL", label: "UL", desc: "Upper Lower" },
    { key: "TL", label: "TL", desc: "Torso Limbs" },
    { key: "FB", label: "FB", desc: "Full Body" },
    { key: "OTHER", label: "Diğer", desc: "Özel split" },
] as const;
type ProgramSplitType = typeof SPLIT_OPTIONS[number]["key"];

type PendingAction =
    | null
    | { type: "exit" }
    | { type: "frequency"; frequency: number; removedCount: number }
    | { type: "copy-day"; targetIndex: number; targetHasData: boolean };

/** Safely convert any value to a trimmed string (handles number, null, undefined). */
function safeString(value: unknown): string {
    if (value == null) return "";
    return String(value).trim();
}

/** Cross-platform alert that falls back to window.alert on web. */
function showAlert(title: string, message: string): void {
    if (Platform.OS === "web") {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
}

function makeDay(index: number): ProgramDay {
    return { label: `Gün ${index + 1}`, exercises: [] };
}

/** Auto-template: N workout days + 1 rest day */
function generateTemplate(freq: number): ProgramDay[] {
    const template: ProgramDay[] = [];
    for (let i = 0; i < freq; i++) {
        template.push({ label: `Gün ${i + 1}`, exercises: [] });
    }
    template.push({ label: "Dinlenme", isRestDay: true, exercises: [] });
    return template;
}

function makeExercise(): TargetExercise {
    return { id: Math.random().toString(36).slice(2), name: "", targetSets: [{ targetReps: "" }] };
}

function makeWarmupSet(): TargetSet {
    return { targetReps: "", isWarmup: true };
}

function makeWorkingSet(): TargetSet {
    return { targetReps: "", isWarmup: false };
}

function insertSetByType<T extends { isWarmup?: boolean }>(sets: T[], nextSet: T, isWarmup: boolean): T[] {
    const insertAfterIndex = isWarmup
        ? sets.map((set) => !!set.isWarmup).lastIndexOf(true)
        : sets.map((set) => !set.isWarmup).lastIndexOf(true);
    const insertIndex = insertAfterIndex >= 0 ? insertAfterIndex + 1 : isWarmup ? 0 : sets.length;
    const copy = [...sets];
    copy.splice(insertIndex, 0, nextSet);
    return copy;
}

function cloneExercise(exercise: TargetExercise): TargetExercise {
    return {
        ...exercise,
        id: Math.random().toString(36).slice(2),
        targetSets: exercise.targetSets.map((set) => ({ ...set })),
    };
}

// ─── Local Types ─────────────────────────────

interface ProgramDay {
    label: string;
    exercises: TargetExercise[];
    isRestDay?: boolean;
}

// ─── Screen ──────────────────────────────────

export default function ProgramCreateScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, "ProgramCreate">>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    // Edit mode params
    const editProgramId = route.params?.editProgramId;
    const editProgramData = route.params?.editProgramData;
    const isEditMode = !!editProgramId;

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [frequency, setFrequency] = useState<number | null>(null);
    const [days, setDays] = useState<ProgramDay[]>([makeDay(0)]);
    const [activeDayIdx, setActiveDayIdx] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [showRPE, setShowRPE] = useState(false);
    const [showRIR, setShowRIR] = useState(false);
    const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
    const [splitModalVisible, setSplitModalVisible] = useState(false);
    const [selectedSplit, setSelectedSplit] = useState<ProgramSplitType>("OTHER");
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);
    const [copyTargetsVisible, setCopyTargetsVisible] = useState(false);
    const [validationNotice, setValidationNotice] = useState<{ title: string; message: string } | null>(null);
    const [conceptNotice, setConceptNotice] = useState<{ title: string; message: string } | null>(null);
    const [reorderModal, setReorderModal] = useState<{
        exerciseId: string;
        currentIndex: number;
        target: string;
    } | null>(null);
    const [libraryPicker, setLibraryPicker] = useState<{ exerciseId: string; query: string } | null>(null);

    // Pre-populate fields in edit mode
    useEffect(() => {
        if (isEditMode && editProgramData) {
            setName(editProgramData.name || "");
            setDescription(editProgramData.description || "");
            const existingSplit = String(editProgramData.data?.splitType || "").toUpperCase();
            if (SPLIT_OPTIONS.some((option) => option.key === existingSplit)) {
                setSelectedSplit(existingSplit as ProgramSplitType);
            }
            const freq = editProgramData.data?.frequency ?? null;
            setFrequency(typeof freq === "number" ? freq : null);
            const rawDays = editProgramData.data?.days || editProgramData.days || [];
            if (rawDays.length > 0) {
                const hasRpeTargets = rawDays.some((day: any) =>
                    (day.exercises || []).some((ex: any) =>
                        (ex.targetSets || []).some((set: any) => !!set.targetRPE),
                    ),
                );
                const hasRirTargets = rawDays.some((day: any) =>
                    (day.exercises || []).some((ex: any) =>
                        (ex.targetSets || []).some((set: any) => !!set.targetRIR),
                    ),
                );
                setShowRPE(hasRpeTargets);
                setShowRIR(hasRirTargets);
                setDays(rawDays.map((d: any) => ({
                    label: d.label || "",
                    isRestDay: !!d.isRestDay,
                    exercises: (d.exercises || []).map((ex: any) => ({
                        id: ex.id || Math.random().toString(36).slice(2),
                        exerciseId: ex.exerciseId,
                        name: ex.name || "",
                        targetSets: (ex.targetSets || []).map((s: any) => ({
                            targetReps: s.targetReps || "",
                            targetWeight: s.targetWeight,
                            targetRPE: s.targetRPE,
                            targetRIR: s.targetRIR,
                            isWarmup: !!s.isWarmup,
                        })),
                    })),
                })));
            }
        }
    }, []);

    // --- Frequency deviation warning ---
    const workoutDayCount = days.filter((d) => !d.isRestDay).length;
    const isFrequencyMismatch = frequency !== null && workoutDayCount !== frequency;

    const applyFrequencyChange = (f: number) => {
        if (f === frequency) return;

        const workoutDays = days.filter((day) => !day.isRestDay);
        const restDays = days.filter((day) => day.isRestDay);
        const nextWorkoutDays =
            f <= workoutDays.length
                ? workoutDays.slice(0, f)
                : [
                    ...workoutDays,
                    ...Array.from({ length: f - workoutDays.length }, (_, index) =>
                        makeDay(workoutDays.length + index),
                    ),
                ];

        const restDay = restDays[0] ?? { label: "Dinlenme", isRestDay: true, exercises: [] };

        setFrequency(f);
        setDays([...nextWorkoutDays, restDay]);
        setActiveDayIdx((prev) => Math.min(prev, nextWorkoutDays.length - 1));
    };

    const handleFrequencyChange = (f: number) => {
        if (f === frequency) return;

        const workoutDays = days.filter((day) => !day.isRestDay);
        const removedWorkoutDays = workoutDays.slice(f);
        const removedHasData = removedWorkoutDays.some((day) => day.exercises.length > 0);

        if (removedHasData) {
            setPendingAction({ type: "frequency", frequency: f, removedCount: removedWorkoutDays.length });
            return;
        }

        applyFrequencyChange(f);
    };

    const clearFrequency = () => {
        setFrequency(null);
        setPendingAction(null);
    };

    // ─── Day Management ───────────────────────

    const addDay = () => {
        if (days.length >= MAX_PROGRAM_DAYS) {
            setValidationNotice({
                title: "Gün sınırı",
                message: `Bir programda en fazla ${MAX_PROGRAM_DAYS} gün olabilir.`,
            });
            return;
        }
        setDays((prev) => {
            const next = [...prev, makeDay(prev.length)];
            setActiveDayIdx(next.length - 1);
            return next;
        });
    };

    const removeDay = (index: number) => {
        if (days.length === 1) {
            showAlert("Hata", "En az bir gün olmalıdır.");
            return;
        }
        setDays((prev) => {
            const next = prev.filter((_, i) => i !== index);
            setActiveDayIdx(Math.min(activeDayIdx, next.length - 1));
            return next;
        });
    };

    const updateDayLabel = (index: number, label: string) => {
        setDays((prev) => prev.map((d, i) => (i === index ? { ...d, label } : d)));
    };

    // ─── Exercise Management ──────────────────

    const addExercise = () => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? { ...d, exercises: [...d.exercises, makeExercise()] }
                    : d
            )
        );
    };

    const libraryResults = React.useMemo(() => {
        const query = safeString(libraryPicker?.query).toLocaleLowerCase("tr-TR");
        const filtered = query
            ? EXERCISE_LIBRARY.filter((item) => {
                const search = [
                    item.name,
                    item.pattern,
                    ...item.aliases,
                    ...item.primaryMuscles,
                    ...item.secondaryMuscles,
                    ...item.equipment,
                ].join(" ").toLocaleLowerCase("tr-TR");
                return search.includes(query);
            })
            : EXERCISE_LIBRARY;
        return [...filtered].sort((a, b) => Number(b.beginnerFriendly) - Number(a.beginnerFriendly));
    }, [libraryPicker?.query]);

    const applyLibraryExercise = (item: ExerciseLibraryItem) => {
        if (!libraryPicker) return;
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                            e.id === libraryPicker.exerciseId
                                ? { ...e, exerciseId: item.id, name: item.name }
                                : e,
                        ),
                    }
                    : d,
            ),
        );
        setLibraryPicker(null);
    };

    const updateExerciseName = (exId: string, exName: string) => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                            e.id === exId
                                ? {
                                    ...e,
                                    name: exName,
                                    exerciseId: EXERCISE_LIBRARY.find((item) => item.id === e.exerciseId)?.name === exName
                                        ? e.exerciseId
                                        : undefined,
                                }
                                : e
                        ),
                    }
                    : d
            )
        );
    };

    const removeExercise = (exId: string) => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? { ...d, exercises: d.exercises.filter((e) => e.id !== exId) }
                    : d
            )
        );
    };

    const moveExerciseToPosition = () => {
        if (!reorderModal) return;
        const targetPosition = parseInt(reorderModal.target, 10);
        const activeExercises = days[activeDayIdx]?.exercises ?? [];

        if (!Number.isFinite(targetPosition) || targetPosition < 1 || targetPosition > activeExercises.length) {
            setValidationNotice({
                title: "Geçersiz sıra",
                message: `Hareket sırası 1 ile ${activeExercises.length} arasında olmalı.`,
            });
            return;
        }

        const toIndex = targetPosition - 1;
        setDays((prev) =>
            prev.map((day, index) => {
                if (index !== activeDayIdx) return day;
                const fromIndex = day.exercises.findIndex((exercise) => exercise.id === reorderModal.exerciseId);
                if (fromIndex < 0 || fromIndex === toIndex) return day;
                const exercises = [...day.exercises];
                const [moved] = exercises.splice(fromIndex, 1);
                exercises.splice(toIndex, 0, moved);
                return { ...day, exercises };
            }),
        );
        setReorderModal(null);
    };

    const toggleRestDay = () => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? { ...d, isRestDay: !d.isRestDay, exercises: !d.isRestDay ? [] : d.exercises }
                    : d
            )
        );
    };

    // ─── Set Management ───────────────────────

    const addSet = (exId: string, isWarmup: boolean = false) => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                            e.id === exId
                                ? { ...e, targetSets: insertSetByType(e.targetSets, isWarmup ? makeWarmupSet() : makeWorkingSet(), isWarmup) }
                                : e
                        ),
                    }
                    : d
            )
        );
    };

    const removeSet = (exId: string, setIdx: number) => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                            e.id === exId
                                ? { ...e, targetSets: e.targetSets.filter((_, si) => si !== setIdx) }
                                : e
                        ),
                    }
                    : d
            )
        );
    };

    const updateSet = (exId: string, setIdx: number, patch: Partial<TargetSet>) => {
        // RPE max clamp to 10
        if (patch.targetRPE) {
            const num = parseFloat(patch.targetRPE);
            if (!isNaN(num) && num > 10) patch = { ...patch, targetRPE: "10" };
        }
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) => {
                            if (e.id !== exId) return e;
                            const newSets = [...e.targetSets];
                            newSets[setIdx] = { ...newSets[setIdx], ...patch };
                            return { ...e, targetSets: newSets };
                        }),
                    }
                    : d
            )
        );
    };

    const reorderSet = (exId: string, fromIdx: number, direction: "up" | "down") => {
        setDays((prev) =>
            prev.map((d, i) => {
                if (i !== activeDayIdx) return d;
                return {
                    ...d,
                    exercises: d.exercises.map((e) => {
                        if (e.id !== exId) return e;
                        const sets = [...e.targetSets];
                        const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
                        if (toIdx < 0 || toIdx >= sets.length) return e;
                        [sets[fromIdx], sets[toIdx]] = [sets[toIdx], sets[fromIdx]];
                        return { ...e, targetSets: sets };
                    }),
                };
            })
        );
    };

    // ─── Validation & Save ────────────────────

    const copyActiveDayToTarget = (targetIndex: number) => {
        const sourceDay = days[activeDayIdx];
        if (!sourceDay || sourceDay.isRestDay || targetIndex === activeDayIdx) return;

        setDays((prev) =>
            prev.map((day, index) =>
                index === targetIndex
                    ? {
                        ...day,
                        isRestDay: false,
                        exercises: sourceDay.exercises.map(cloneExercise),
                    }
                    : day,
            ),
        );
        setActiveDayIdx(targetIndex);
        setCopyTargetsVisible(false);
    };

    const handleCopyDay = (targetIndex: number) => {
        const targetDay = days[targetIndex];
        if (!targetDay || targetIndex === activeDayIdx) return;

        const targetHasData = targetDay.exercises.length > 0 || !!targetDay.isRestDay;
        if (targetHasData) {
            setPendingAction({ type: "copy-day", targetIndex, targetHasData });
            return;
        }

        copyActiveDayToTarget(targetIndex);
    };

    const hasUnsavedChanges = React.useMemo(() => {
        return (
            safeString(name) !== "" ||
            safeString(description) !== "" ||
            days.some((day) => day.exercises.length > 0)
        );
    }, [days, description, name]);

    const requestExit = () => {
        if (hasUnsavedChanges) {
            setPendingAction({ type: "exit" });
            return;
        }
        navigation.goBack();
    };

    const confirmPendingAction = () => {
        const action = pendingAction;
        setPendingAction(null);

        if (!action) return;
        if (action.type === "exit") {
            navigation.goBack();
            return;
        }
        if (action.type === "frequency") {
            applyFrequencyChange(action.frequency);
            return;
        }
        if (action.type === "copy-day") {
            copyActiveDayToTarget(action.targetIndex);
        }
    };

    const pendingModalCopyTargetLabel =
        pendingAction?.type === "copy-day"
            ? days[pendingAction.targetIndex]?.label ?? `Gün ${pendingAction.targetIndex + 1}`
            : "";

    const pendingModalProps = (() => {
        if (!pendingAction) return null;

        if (pendingAction.type === "exit") {
            return {
                title: "Kaydedilmemiş değişiklikler var",
                message: "Programı kaydetmeden çıkarsanız yaptığınız değişiklikler kaybolur.",
                primaryLabel: "Çık",
                secondaryLabel: "Devam Et",
                destructivePrimary: true,
            };
        }

        if (pendingAction.type === "frequency") {
            return {
                title: "Frekansı düşürüyorsunuz",
                message: `Bu değişiklik ${pendingAction.removedCount} antrenman gününü kaldıracak. Bu günlerde yazdığınız egzersizler silinir.`,
                primaryLabel: "Devam Et",
                secondaryLabel: "Vazgeç",
                destructivePrimary: true,
            };
        }

        return {
            title: "Günün üzerine yazılsın mı?",
            message: `${pendingModalCopyTargetLabel} içindeki mevcut içerik silinip ${days[activeDayIdx]?.label ?? "aktif gün"} ile değiştirilecek.`,
            primaryLabel: "Üzerine Yaz",
            secondaryLabel: "Vazgeç",
            destructivePrimary: true,
        };
    })();

    const handleSave = useCallback(() => {
        if (safeString(name) === "") {
            setValidationNotice({ title: "Program adı eksik", message: "Kaydetmeden önce programa bir isim verin." });
            return;
        }

        const emptyWorkoutDays = days.filter((day) => !day.isRestDay && day.exercises.length === 0);
        if (emptyWorkoutDays.length > 0) {
            setValidationNotice({
                title: "Eksik günler var",
                message: `${emptyWorkoutDays.map((day) => day.label).join(", ")} için en az bir egzersiz eklemelisin.`,
            });
            return;
        }

        for (const day of days) {
            if (day.isRestDay) continue;

            for (const ex of day.exercises) {
                if (safeString(ex.name) === "") {
                    setValidationNotice({
                        title: "Egzersiz adı eksik",
                        message: `${day.label} içinde tüm egzersizlerin ismi olmalı.`,
                    });
                    return;
                }
                if (ex.targetSets.length === 0) {
                    setValidationNotice({
                        title: "Set eksik",
                        message: `"${ex.name}" için en az bir set ekleyin.`,
                    });
                    return;
                }
                for (const s of ex.targetSets) {
                    if (safeString(s.targetReps) === "") {
                        setValidationNotice({
                            title: "Tekrar hedefi eksik",
                            message: `"${ex.name}" egzersizinin eksik tekrar hedefleri var.`,
                        });
                        return;
                    }
                }
            }
        }

        // Validasyon geçti — gizlilik seçim modalını aç
        setPrivacyModalVisible(true);
    }, [name, days]);

    const doSave = useCallback(async (isPublic: boolean, splitType?: ProgramSplitType) => {
        setPrivacyModalVisible(false);
        setSplitModalVisible(false);
        try {
            setIsSaving(true);
            const programData = {
                ...(frequency !== null ? { frequency } : {}),
                ...(isPublic ? { splitType: splitType ?? selectedSplit } : {}),
                days: days.map((d) => ({
                    label: d.label,
                    isRestDay: !!d.isRestDay,
                    exercises: d.isRestDay ? [] : d.exercises.map((ex) => ({
                        id: ex.id,
                        exerciseId: ex.exerciseId,
                        name: safeString(ex.name),
                        targetSets: ex.targetSets.map((s) => ({
                            targetReps: safeString(s.targetReps),
                            targetWeight: safeString(s.targetWeight) || undefined,
                            targetRPE: safeString(s.targetRPE) || undefined,
                            targetRIR: safeString(s.targetRIR) || undefined,
                            isWarmup: !!s.isWarmup,
                        })),
                    })),
                })),
            };

            if (isEditMode && editProgramId) {
                await programApi.update(editProgramId, {
                    name: safeString(name),
                    description: safeString(description),
                    isPublic,
                    frequency: frequency ?? workoutDayCount,
                    data: programData,
                });
            } else {
                await programApi.create({
                    name: safeString(name),
                    description: safeString(description),
                    isPublic,
                    frequency: frequency ?? workoutDayCount,
                    data: programData,
                });
            }
            navigation.goBack();
        } catch (error) {
            const apiError = parseApiError(error);
            showAlert("Kaydetme Hatası", apiError.message);
        } finally {
            setIsSaving(false);
        }
    }, [days, frequency, name, description, isEditMode, editProgramId, navigation, selectedSplit]);

    const activeDay = days[activeDayIdx];

    // ─── Render ──────────────────────────────

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 80}
        >
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={requestExit} style={styles.iconBtn}>
                    <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditMode ? "Programı Düzenle" : "Yeni Program"}</Text>
                <TouchableOpacity onPress={handleSave} disabled={isSaving} style={styles.iconBtn}>
                    <Ionicons
                        name="checkmark"
                        size={28}
                        color={isSaving ? colors.textSecondary : colors.accent}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                {/* ── Meta ── */}
                <View style={styles.metaCard}>
                    <Text style={styles.label}>Program Adı *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Örn: Push/Pull/Legs"
                        placeholderTextColor={colors.textSecondary}
                        value={name}
                        onChangeText={setName}
                    />
                    <Text style={[styles.label, { marginTop: spacing.md }]}>Açıklama (Opsiyonel)</Text>
                    <TextInput
                        style={[styles.input, { height: 72 }]}
                        placeholder="Programın amacı, notlar..."
                        placeholderTextColor={colors.textSecondary}
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />
                </View>

                {/* ── Frequency Selector ── */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionTitle}>🗓 Haftalık Frekans</Text>
                        {frequency !== null && (
                            <TouchableOpacity onPress={clearFrequency} style={styles.clearFrequencyBtn}>
                                <Text style={styles.clearFrequencyText}>Temizle</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.sectionSubtitle}>İstersen haftalık hedefini seç. Seçmezsen sadece gün döngüsü takip edilir.</Text>
                    <View style={styles.freqRow}>
                        {FREQUENCY_OPTIONS.map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[
                                    styles.freqChip,
                                    frequency === f && styles.freqChipActive,
                                ]}
                                onPress={() => handleFrequencyChange(f)}
                                activeOpacity={0.75}
                            >
                                <Text
                                    style={[
                                        styles.freqChipText,
                                        frequency === f && styles.freqChipTextActive,
                                    ]}
                                >
                                    {f}
                                </Text>
                                <Text
                                    style={[
                                        styles.freqChipSub,
                                        frequency === f && { color: colors.background },
                                    ]}
                                >
                                    gün
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Day Tabs ── */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Antrenman Günleri</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.dayTabsScroll}
                        contentContainerStyle={styles.dayTabsContent}
                    >
                        {days.map((day, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[styles.dayTab, activeDayIdx === idx && styles.dayTabActive]}
                                onPress={() => setActiveDayIdx(idx)}
                            >
                                <Text
                                    style={[
                                        styles.dayTabText,
                                        activeDayIdx === idx && styles.dayTabTextActive,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {day.label}
                                </Text>
                                {day.isRestDay ? (
                                    <View style={[styles.dayTabBadge, { backgroundColor: colors.textMuted }]}>
                                        <Ionicons name="bed" size={10} color={colors.background} />
                                    </View>
                                ) : day.exercises.length > 0 ? (
                                    <View style={styles.dayTabBadge}>
                                        <Text style={styles.dayTabBadgeText}>{day.exercises.length}</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.addDayBtn, days.length >= MAX_PROGRAM_DAYS && styles.addDayBtnDisabled]}
                            onPress={addDay}
                            disabled={days.length >= MAX_PROGRAM_DAYS}
                        >
                            <Ionicons
                                name="add"
                                size={20}
                                color={days.length >= MAX_PROGRAM_DAYS ? colors.textMuted : colors.accent}
                            />
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Active day label editor */}
                    <View style={styles.dayLabelRow}>
                        <TextInput
                            style={styles.dayLabelInput}
                            value={activeDay.label}
                            onChangeText={(t) => updateDayLabel(activeDayIdx, t)}
                            placeholder="Örn: Gün 1 — Anterior"
                            placeholderTextColor={colors.textSecondary}
                        />
                        {days.length > 1 && (
                            <TouchableOpacity
                                style={styles.removeDayBtn}
                                onPress={() => removeDay(activeDayIdx)}
                            >
                                <Ionicons name="trash-outline" size={18} color={colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Frequency deviation warning */}
                    {isFrequencyMismatch && frequency !== null && (
                        <View style={styles.warningBanner}>
                            <Ionicons name="warning-outline" size={16} color="#F59E0B" />
                            <Text style={styles.warningText}>
                                Seçtiğiniz frekans ({frequency}) ile antrenman gün sayısı ({workoutDayCount}) uyuşmuyor.
                            </Text>
                        </View>
                    )}
                    {days.length >= MAX_PROGRAM_DAYS && (
                        <Text style={styles.dayLimitText}>Maksimum {MAX_PROGRAM_DAYS} gün eklenebilir.</Text>
                    )}
                </View>

                {/* ── Exercises for Active Day ── */}
                <View style={styles.sectionCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                            Egzersizler — {activeDay.label}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                            {!activeDay.isRestDay && activeDay.exercises.length > 0 && days.length > 1 && (
                                <TouchableOpacity
                                    style={styles.headerActionBtn}
                                    onPress={() => setCopyTargetsVisible((visible) => !visible)}
                                >
                                    <Ionicons name="copy-outline" size={18} color={colors.accent} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                                onPress={toggleRestDay}
                            >
                                <Ionicons
                                    name={activeDay.isRestDay ? "checkbox" : "square-outline"}
                                    size={20}
                                    color={activeDay.isRestDay ? colors.accent : colors.textSecondary}
                                />
                                <Text style={{ fontSize: fontSize.sm, color: activeDay.isRestDay ? colors.accent : colors.textSecondary }}>Dinlenme Günü</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {copyTargetsVisible && !activeDay.isRestDay && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.copyDayTargets}
                            style={styles.copyDayTargetScroll}
                        >
                            {days.map((day, idx) => {
                                if (idx === activeDayIdx || day.isRestDay) return null;
                                return (
                                    <TouchableOpacity
                                        key={`copy-${idx}`}
                                        style={styles.copyDayChip}
                                        onPress={() => handleCopyDay(idx)}
                                    >
                                        <Text style={styles.copyDayChipText}>{day.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}

                    {/* RPE/RIR Toggle Buttons */}
                    {!activeDay.isRestDay && (
                        <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
                            <TouchableOpacity
                                style={[{
                                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                                    paddingVertical: spacing.sm, borderRadius: borderRadius.sm,
                                    borderWidth: 1.5,
                                    borderColor: showRPE ? colors.accent : colors.border,
                                    backgroundColor: showRPE ? colors.accentMuted : "transparent",
                                    gap: spacing.xs,
                                }]}
                                onPress={() => setShowRPE(!showRPE)}
                            >
                                <Ionicons name={showRPE ? "checkbox" : "square-outline"} size={16} color={showRPE ? colors.accent : colors.textMuted} />
                                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: showRPE ? colors.accent : colors.textMuted }}>RPE</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.infoBtn}
                                onPress={() => setConceptNotice({
                                    title: "RPE nedir?",
                                    message: "RPE, setin ne kadar zor hissettirdiğini 0-10 arası puanlamaktır. 10, daha tekrar çıkmazdı demektir; 7 ise yaklaşık 3 tekrar daha çıkardı anlamına gelir.",
                                })}
                            >
                                <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[{
                                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                                    paddingVertical: spacing.sm, borderRadius: borderRadius.sm,
                                    borderWidth: 1.5,
                                    borderColor: showRIR ? colors.accent : colors.border,
                                    backgroundColor: showRIR ? colors.accentMuted : "transparent",
                                    gap: spacing.xs,
                                }]}
                                onPress={() => setShowRIR(!showRIR)}
                            >
                                <Ionicons name={showRIR ? "checkbox" : "square-outline"} size={16} color={showRIR ? colors.accent : colors.textMuted} />
                                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: showRIR ? colors.accent : colors.textMuted }}>RIR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.infoBtn}
                                onPress={() => setConceptNotice({
                                    title: "RIR nedir?",
                                    message: "RIR, sette kaç tekrar daha yapabileceğini tahmin etmektir. RIR 2, o sette yaklaşık 2 tekrar yedek kaldı demektir.",
                                })}
                            >
                                <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeDay.isRestDay ? (
                        <View style={{ paddingVertical: spacing.xxl, alignItems: "center" }}>
                            <Ionicons name="bed-outline" size={48} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
                            <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>Bugün dinlenme günü olarak işaretlendi.</Text>
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.xs }}>Egzersiz eklemek için yukarıdan işareti kaldırın.</Text>
                        </View>
                    ) : (
                        <>
                            {activeDay.exercises.map((exercise, exIndex) => (
                                <View key={exercise.id} style={styles.exerciseCard}>
                                    <View style={styles.exHeader}>
                                        <TouchableOpacity
                                            style={styles.exNumberBtn}
                                            onPress={() =>
                                                setReorderModal({
                                                    exerciseId: exercise.id,
                                                    currentIndex: exIndex,
                                                    target: String(exIndex + 1),
                                                })
                                            }
                                            activeOpacity={0.75}
                                        >
                                            <Text style={styles.exNumber} numberOfLines={1}>#{exIndex + 1}</Text>
                                        </TouchableOpacity>
                                        <TextInput
                                            style={styles.exNameInput}
                                            placeholder="Egzersiz Adı (Örn: Bench Press)"
                                            placeholderTextColor={colors.textSecondary}
                                            value={exercise.name}
                                            onChangeText={(t) => updateExerciseName(exercise.id, t)}
                                        />
                                        <TouchableOpacity
                                            style={styles.libraryPickBtn}
                                            onPress={() => setLibraryPicker({ exerciseId: exercise.id, query: exercise.name })}
                                            accessibilityLabel="Egzersiz kutuphanesinden sec"
                                        >
                                            <Ionicons name="library-outline" size={20} color={colors.accent} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                                            <Ionicons name="trash-outline" size={22} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                    {exercise.exerciseId && (
                                        <View style={styles.libraryLinkedBadge}>
                                            <Ionicons name="checkmark-circle-outline" size={14} color={colors.accent} />
                                            <Text style={styles.libraryLinkedText}>Kutuphaneden secildi</Text>
                                        </View>
                                    )}

                                    {(() => {
                                        let warmupCount = 0;
                                        let workingCount = 0;
                                        return exercise.targetSets.map((set, setIndex) => {
                                            const isWarmup = !!set.isWarmup;
                                            if (isWarmup) warmupCount++;
                                            else workingCount++;
                                            const label = isWarmup ? `W${warmupCount}` : `${workingCount}`;
                                            return (
                                                <View key={setIndex} style={styles.setRow}>
                                                    <TouchableOpacity
                                                        onLongPress={() => { }}
                                                        style={{ justifyContent: "center", marginRight: 2 }}
                                                    >
                                                        <TouchableOpacity
                                                            onPress={() => reorderSet(exercise.id, setIndex, "up")}
                                                            disabled={setIndex === 0}
                                                            hitSlop={{ top: 4, bottom: 2, left: 4, right: 4 }}
                                                        >
                                                            <Ionicons name="chevron-up" size={14} color={setIndex === 0 ? colors.border : colors.textSecondary} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => reorderSet(exercise.id, setIndex, "down")}
                                                            disabled={setIndex === exercise.targetSets.length - 1}
                                                            hitSlop={{ top: 2, bottom: 4, left: 4, right: 4 }}
                                                        >
                                                            <Ionicons name="chevron-down" size={14} color={setIndex === exercise.targetSets.length - 1 ? colors.border : colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </TouchableOpacity>
                                                    <Text style={[styles.setLabel, isWarmup && { color: colors.textMuted, fontStyle: "italic" as const }]}>
                                                        {label}
                                                    </Text>

                                                    <View style={styles.setInputGroup}>
                                                        <View style={styles.setCol}>
                                                            <Text style={styles.setColLabel}>Tekrar</Text>
                                                            <TextInput
                                                                style={styles.setInput}
                                                                placeholder="8-12"
                                                                placeholderTextColor={colors.textSecondary}
                                                                keyboardType="number-pad"
                                                                value={set.targetReps}
                                                                onChangeText={(t) => updateSet(exercise.id, setIndex, { targetReps: t })}
                                                            />
                                                        </View>
                                                        {showRPE && (
                                                            <View style={styles.setCol}>
                                                                <Text style={styles.setColLabel}>RPE</Text>
                                                                <TextInput
                                                                    style={styles.setInput}
                                                                    placeholder="8"
                                                                    placeholderTextColor={colors.textSecondary}
                                                                    keyboardType="numeric"
                                                                    value={set.targetRPE || ""}
                                                                    onChangeText={(t) => updateSet(exercise.id, setIndex, { targetRPE: t })}
                                                                />
                                                            </View>
                                                        )}
                                                        {showRIR && (
                                                            <View style={styles.setCol}>
                                                                <Text style={styles.setColLabel}>RIR</Text>
                                                                <TextInput
                                                                    style={styles.setInput}
                                                                    placeholder="2"
                                                                    placeholderTextColor={colors.textSecondary}
                                                                    value={set.targetRIR || ""}
                                                                    onChangeText={(t) => updateSet(exercise.id, setIndex, { targetRIR: t })}
                                                                />
                                                            </View>
                                                        )}
                                                    </View>

                                                    <TouchableOpacity
                                                        onPress={() => removeSet(exercise.id, setIndex)}
                                                        style={styles.removeSetBtn}
                                                    >
                                                        <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                                                    </TouchableOpacity>
                                                </View>
                                            );
                                        });
                                    })()}

                                    <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
                                        <TouchableOpacity
                                            style={[styles.addSetBtn, { flex: 1 }]}
                                            onPress={() => addSet(exercise.id, true)}
                                        >
                                            <Ionicons name="flame-outline" size={14} color={colors.textMuted} />
                                            <Text style={[styles.addSetText, { color: colors.textMuted }]}>Isınma Seti</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.addSetBtn, { flex: 1 }]}
                                            onPress={() => addSet(exercise.id, false)}
                                        >
                                            <Ionicons name="add" size={16} color={colors.accent} />
                                            <Text style={styles.addSetText}>Çalışma Seti</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            {/* Add Exercise Button */}
                            <TouchableOpacity style={styles.addExerciseBtn} onPress={addExercise}>
                                <Ionicons name="barbell-outline" size={20} color={colors.background} />
                                <Text style={styles.addExerciseText}>Egzersiz Ekle</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* ── Privacy Modal (cross-platform) ── */}
            <Modal
                visible={!!reorderModal}
                transparent
                animationType="fade"
                onRequestClose={() => setReorderModal(null)}
            >
                <View style={styles.reorderOverlay}>
                    <View style={styles.reorderModal}>
                        <Text style={styles.reorderTitle}>Hareket sırası</Text>
                        <Text style={styles.reorderMessage}>
                            Bu hareketi kaçıncı sıraya taşımak istiyorsun?
                        </Text>
                        <TextInput
                            style={styles.reorderInput}
                            value={reorderModal?.target ?? ""}
                            onChangeText={(text) =>
                                setReorderModal((prev) => prev ? { ...prev, target: text.replace(/[^0-9]/g, "") } : prev)
                            }
                            keyboardType="number-pad"
                            placeholder={`1-${activeDay?.exercises.length ?? 1}`}
                            placeholderTextColor={colors.textMuted}
                            selectionColor={colors.accent}
                            autoFocus
                        />
                        <Text style={styles.reorderHint}>
                            Min 1, max {activeDay?.exercises.length ?? 1}. Diğer hareketler otomatik kayar.
                        </Text>
                        <View style={styles.reorderActions}>
                            <TouchableOpacity
                                style={styles.reorderSecondaryBtn}
                                onPress={() => setReorderModal(null)}
                            >
                                <Text style={styles.reorderSecondaryText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.reorderPrimaryBtn}
                                onPress={moveExerciseToPosition}
                            >
                                <Text style={styles.reorderPrimaryText}>Taşı</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={!!libraryPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setLibraryPicker(null)}
            >
                <View style={styles.libraryOverlay}>
                    <View style={styles.libraryModal}>
                        <View style={styles.libraryHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.libraryTitle}>Egzersiz kutuphanesi</Text>
                                <Text style={styles.librarySubtitle}>Kutuphaneden secilen hareketler ileride daha tutarli takip edilir.</Text>
                            </View>
                            <TouchableOpacity style={styles.libraryCloseBtn} onPress={() => setLibraryPicker(null)}>
                                <Ionicons name="close" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.librarySearchInput}
                            value={libraryPicker?.query ?? ""}
                            onChangeText={(query) => setLibraryPicker((prev) => prev ? { ...prev, query } : prev)}
                            placeholder="Hareket, kas veya ekipman ara"
                            placeholderTextColor={colors.textMuted}
                            autoFocus
                        />
                        <ScrollView style={styles.libraryList} showsVerticalScrollIndicator={false}>
                            {libraryResults.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.libraryResultCard}
                                    activeOpacity={0.84}
                                    onPress={() => applyLibraryExercise(item)}
                                >
                                    <View style={styles.libraryResultTop}>
                                        <View style={styles.libraryResultIcon}>
                                            <Ionicons name="barbell-outline" size={18} color={colors.accent} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.libraryResultName}>{item.name}</Text>
                                            <Text style={styles.libraryResultMeta}>
                                                {[...item.primaryMuscles, ...item.equipment].slice(0, 4).join(" · ")}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                                    </View>
                                    <Text style={styles.libraryResultNote} numberOfLines={2}>{item.coachNotes}</Text>
                                </TouchableOpacity>
                            ))}
                            {libraryResults.length === 0 && (
                                <View style={styles.libraryEmpty}>
                                    <Text style={styles.libraryEmptyText}>Sonuc bulunamadi. Istersen hareketi serbest yazabilirsin.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <PrivacyModal
                visible={privacyModalVisible}
                onSelectPrivate={() => doSave(false)}
                onSelectPublic={() => {
                    setPrivacyModalVisible(false);
                    setSplitModalVisible(true);
                }}
                onCancel={() => setPrivacyModalVisible(false)}
            />
            <Modal
                visible={splitModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSplitModalVisible(false)}
            >
                <View style={styles.splitOverlay}>
                    <View style={styles.splitModal}>
                        <Text style={styles.splitTitle}>Program Spliti</Text>
                        <Text style={styles.splitMessage}>
                            Public programların keşfette filtrelenebilmesi için split tipini seç.
                        </Text>
                        <View style={styles.splitGrid}>
                            {SPLIT_OPTIONS.map((option) => {
                                const isActive = selectedSplit === option.key;
                                return (
                                    <TouchableOpacity
                                        key={option.key}
                                        style={[styles.splitOption, isActive && styles.splitOptionActive]}
                                        onPress={() => setSelectedSplit(option.key)}
                                    >
                                        <Text style={[styles.splitOptionLabel, isActive && styles.splitOptionLabelActive]}>
                                            {option.label}
                                        </Text>
                                        <Text style={[styles.splitOptionDesc, isActive && styles.splitOptionDescActive]}>
                                            {option.desc}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.splitActions}>
                            <TouchableOpacity
                                style={styles.splitSecondaryBtn}
                                onPress={() => setSplitModalVisible(false)}
                            >
                                <Text style={styles.splitSecondaryText}>İptal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.splitPrimaryBtn}
                                onPress={() => doSave(true, selectedSplit)}
                            >
                                <Text style={styles.splitPrimaryText}>Public Kaydet</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {pendingModalProps && (
                <ActionConfirmModal
                    visible={!!pendingAction}
                    title={pendingModalProps.title}
                    message={pendingModalProps.message}
                    primaryLabel={pendingModalProps.primaryLabel}
                    secondaryLabel={pendingModalProps.secondaryLabel}
                    destructivePrimary={pendingModalProps.destructivePrimary}
                    onPrimary={confirmPendingAction}
                    onSecondary={() => setPendingAction(null)}
                    onDismiss={() => setPendingAction(null)}
                />
            )}
            <NoticeModal
                visible={!!validationNotice}
                title={validationNotice?.title ?? ""}
                message={validationNotice?.message ?? ""}
                onClose={() => setValidationNotice(null)}
            />
            <NoticeModal
                visible={!!conceptNotice}
                title={conceptNotice?.title ?? ""}
                message={conceptNotice?.message ?? ""}
                onClose={() => setConceptNotice(null)}
            />
        </KeyboardAvoidingView>
    );
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 50,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    iconBtn: {
        padding: spacing.xs,
        minWidth: 44,
        alignItems: "center",
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    metaCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    label: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        color: colors.text,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
    },
    sectionTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    sectionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.xs,
    },
    clearFrequencyBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceElevated,
    },
    clearFrequencyText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        color: colors.textSecondary,
    },
    sectionSubtitle: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    // Frequency
    freqRow: {
        flexDirection: "row",
        gap: spacing.sm,
        flexWrap: "wrap",
    },
    freqChip: {
        alignItems: "center",
        justifyContent: "center",
        width: 48,
        height: 56,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1.5,
        borderColor: colors.border,
    },
    freqChipActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    freqChipText: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.heavy,
        color: colors.text,
    },
    freqChipTextActive: {
        color: colors.background,
    },
    freqChipSub: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
    // Day Tabs
    dayTabsScroll: {
        marginBottom: spacing.md,
    },
    dayTabsContent: {
        gap: spacing.sm,
        paddingBottom: spacing.xs,
    },
    dayTab: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
        minHeight: 40,
    },
    dayTabActive: {
        backgroundColor: colors.accentMuted,
        borderColor: colors.accent,
    },
    dayTabText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        color: colors.textSecondary,
        maxWidth: 90,
    },
    dayTabTextActive: {
        color: colors.accent,
        fontWeight: fontWeight.bold,
    },
    dayTabBadge: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    dayTabBadgeText: {
        fontSize: 10,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
    addDayBtn: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        borderWidth: 1.5,
        borderColor: colors.accent,
        borderStyle: "dashed",
        alignItems: "center",
        justifyContent: "center",
    },
    addDayBtnDisabled: {
        borderColor: colors.border,
        opacity: 0.55,
    },
    infoBtn: {
        width: 40,
        minHeight: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    dayLimitText: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    dayLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    dayLabelInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        color: colors.accent,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    removeDayBtn: {
        padding: spacing.sm,
    },
    headerActionBtn: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    copyDayTargetScroll: {
        marginBottom: spacing.md,
    },
    copyDayTargets: {
        gap: spacing.sm,
    },
    copyDayChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    copyDayChipText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.accent,
    },
    // Exercises
    exerciseCard: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    exHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    exNumberBtn: {
        marginRight: spacing.sm,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
        minWidth: 44,
        minHeight: 34,
        alignItems: "center",
        justifyContent: "center",
    },
    exNumber: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.accent,
        textAlign: "center",
        lineHeight: 24,
    },
    exNameInput: {
        flex: 1,
        fontSize: fontSize.md,
        fontWeight: "bold",
        color: colors.text,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingVertical: spacing.sm,
        marginRight: spacing.sm,
    },
    libraryPickBtn: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
        marginRight: spacing.sm,
    },
    libraryLinkedBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    libraryLinkedText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        color: colors.accent,
    },
    // Sets
    setRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    setLabel: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        color: colors.textSecondary,
        minWidth: 44,
    },
    setInputGroup: {
        flex: 1,
        flexDirection: "row",
        gap: spacing.xs,
    },
    setCol: {
        flex: 1,
        gap: 3,
    },
    setColLabel: {
        fontSize: 10,
        color: colors.textMuted,
        fontWeight: fontWeight.medium,
        textTransform: "uppercase",
        textAlign: "center",
    },
    setInput: {
        backgroundColor: colors.surfaceElevated,
        color: colors.text,
        fontSize: fontSize.sm,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        textAlign: "center",
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    removeSetBtn: {
        padding: spacing.xs,
    },
    addSetBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.sm,
        borderStyle: "dashed",
        gap: spacing.xs,
    },
    addSetText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.medium,
        color: colors.textSecondary,
    },
    addExerciseBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        marginTop: spacing.sm,
        gap: spacing.sm,
        minHeight: 56,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    addExerciseText: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
    reorderOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.62)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    reorderModal: {
        width: "100%",
        maxWidth: 420,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    reorderTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    reorderMessage: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    reorderInput: {
        minHeight: 54,
        borderRadius: borderRadius.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    reorderHint: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginBottom: spacing.lg,
    },
    reorderActions: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    reorderSecondaryBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
    },
    reorderSecondaryText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
    },
    reorderPrimaryBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
    },
    reorderPrimaryText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.background,
    },
    libraryOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.68)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    libraryModal: {
        width: "100%",
        maxWidth: 560,
        maxHeight: "86%",
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    libraryHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    libraryTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
    },
    librarySubtitle: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginTop: 2,
    },
    libraryCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    librarySearchInput: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.text,
        paddingHorizontal: spacing.md,
        fontSize: fontSize.md,
        marginBottom: spacing.md,
    },
    libraryList: {
        maxHeight: 520,
    },
    libraryResultCard: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    libraryResultTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    libraryResultIcon: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    libraryResultName: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    libraryResultMeta: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    libraryResultNote: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 19,
    },
    libraryEmpty: {
        paddingVertical: spacing.xl,
        alignItems: "center",
    },
    libraryEmptyText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        textAlign: "center",
    },
    splitOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.68)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    splitModal: {
        width: "100%",
        maxWidth: 440,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
    },
    splitTitle: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        marginBottom: spacing.xs,
    },
    splitMessage: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    splitGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    splitOption: {
        width: "48%",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        padding: spacing.md,
    },
    splitOptionActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    splitOptionLabel: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        marginBottom: 2,
    },
    splitOptionLabelActive: {
        color: colors.accent,
    },
    splitOptionDesc: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
    },
    splitOptionDescActive: {
        color: colors.textSecondary,
    },
    splitActions: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    splitSecondaryBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        paddingVertical: spacing.md,
    },
    splitSecondaryText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    splitPrimaryBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        paddingVertical: spacing.md,
    },
    splitPrimaryText: {
        color: colors.background,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    warningBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(245,158,11,0.12)",
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginTop: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: "rgba(245,158,11,0.3)",
    },
    warningText: {
        flex: 1,
        fontSize: fontSize.xs,
        color: "#F59E0B",
    },
});
