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

// ─── Helpers ─────────────────────────────────

const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6, 7];

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
    const [frequency, setFrequency] = useState(3);
    const [days, setDays] = useState<ProgramDay[]>(generateTemplate(3));
    const [activeDayIdx, setActiveDayIdx] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [showRPE, setShowRPE] = useState(false);
    const [showRIR, setShowRIR] = useState(false);
    const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

    // Pre-populate fields in edit mode
    useEffect(() => {
        if (isEditMode && editProgramData) {
            setName(editProgramData.name || "");
            setDescription(editProgramData.description || "");
            const freq = editProgramData.data?.frequency || editProgramData.frequency || 3;
            setFrequency(freq);
            const rawDays = editProgramData.data?.days || editProgramData.days || [];
            if (rawDays.length > 0) {
                setDays(rawDays.map((d: any) => ({
                    label: d.label || "",
                    isRestDay: !!d.isRestDay,
                    exercises: (d.exercises || []).map((ex: any) => ({
                        id: ex.id || Math.random().toString(36).slice(2),
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
    const isFrequencyMismatch = workoutDayCount !== frequency;

    const handleFrequencyChange = (f: number) => {
        setFrequency(f);
        // Auto-generate template when frequency changes
        const newDays = generateTemplate(f);
        setDays(newDays);
        setActiveDayIdx(0);
    };

    // ─── Day Management ───────────────────────

    const addDay = () => {
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

    const updateExerciseName = (exId: string, exName: string) => {
        setDays((prev) =>
            prev.map((d, i) =>
                i === activeDayIdx
                    ? {
                        ...d,
                        exercises: d.exercises.map((e) =>
                            e.id === exId ? { ...e, name: exName } : e
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
                                ? { ...e, targetSets: [...e.targetSets, isWarmup ? makeWarmupSet() : makeWorkingSet()] }
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

    const handleSave = useCallback(() => {
        if (safeString(name) === "") {
            showAlert("Hata", "Lütfen programa bir isim verin.");
            return;
        }

        const hasExercises = days.some((d) => d.exercises.length > 0);
        if (!hasExercises) {
            showAlert("Hata", "En az bir güne egzersiz ekleyin.");
            return;
        }

        for (const day of days) {
            if (day.isRestDay) continue;

            for (const ex of day.exercises) {
                if (safeString(ex.name) === "") {
                    showAlert("Hata", `${day.label}: Tüm egzersizlerin ismi olmalı.`);
                    return;
                }
                if (ex.targetSets.length === 0) {
                    showAlert("Hata", `"${ex.name}" için en az bir set ekleyin.`);
                    return;
                }
                for (const s of ex.targetSets) {
                    if (safeString(s.targetReps) === "") {
                        showAlert("Hata", `"${ex.name}" egzersizinin eksik tekrar hedefleri var.`);
                        return;
                    }
                }
            }
        }

        // Validasyon geçti — gizlilik seçim modalını aç
        setPrivacyModalVisible(true);
    }, [name, days]);

    const doSave = useCallback(async (isPublic: boolean) => {
        setPrivacyModalVisible(false);
        try {
            setIsSaving(true);
            const programData = {
                frequency,
                days: days.map((d) => ({
                    label: d.label,
                    isRestDay: !!d.isRestDay,
                    exercises: d.isRestDay ? [] : d.exercises.map((ex) => ({
                        id: ex.id,
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
                    frequency,
                    data: programData,
                });
            } else {
                await programApi.create({
                    name: safeString(name),
                    description: safeString(description),
                    isPublic,
                    frequency,
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
    }, [days, frequency, name, description, isEditMode, editProgramId, navigation]);

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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
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
                    <Text style={styles.sectionTitle}>🗓 Haftalık Frekans</Text>
                    <Text style={styles.sectionSubtitle}>Haftada kaç gün antrenman yapacaksın?</Text>
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
                    <Text style={styles.sectionTitle}>🏋️ Antrenman Günleri</Text>
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
                        <TouchableOpacity style={styles.addDayBtn} onPress={addDay}>
                            <Ionicons name="add" size={20} color={colors.accent} />
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
                    {isFrequencyMismatch && (
                        <View style={styles.warningBanner}>
                            <Ionicons name="warning-outline" size={16} color="#F59E0B" />
                            <Text style={styles.warningText}>
                                Seçtiğiniz frekans ({frequency}) ile antrenman gün sayısı ({workoutDayCount}) uyuşmuyor.
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── Exercises for Active Day ── */}
                <View style={styles.sectionCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
                            Egzersizler — {activeDay.label}
                        </Text>
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
                                        <Text style={styles.exNumber}>#{exIndex + 1}</Text>
                                        <TextInput
                                            style={styles.exNameInput}
                                            placeholder="Egzersiz Adı (Örn: Bench Press)"
                                            placeholderTextColor={colors.textSecondary}
                                            value={exercise.name}
                                            onChangeText={(t) => updateExerciseName(exercise.id, t)}
                                        />
                                        <TouchableOpacity onPress={() => removeExercise(exercise.id)}>
                                            <Ionicons name="trash-outline" size={22} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>

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
            <PrivacyModal
                visible={privacyModalVisible}
                onSelectPrivate={() => doSave(false)}
                onSelectPublic={() => doSave(true)}
                onCancel={() => setPrivacyModalVisible(false)}
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
    exNumber: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.accent,
        marginRight: spacing.sm,
        minWidth: 28,
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
