import React from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AccentButton from "../components/AccentButton";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { CardioType, TargetExercise, WarmupRoutineTemplate } from "../types/workout";

type Route = RouteProp<RootStackParamList, "WarmupRoutineBuilder">;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

const CARDIO_TYPES: { type: CardioType; label: string }[] = [
    { type: "treadmill", label: "Treadmill" },
    { type: "bike", label: "Bisiklet" },
    { type: "elliptical", label: "Eliptik" },
    { type: "outdoor_run", label: "Serbest kosu" },
    { type: "daily_steps", label: "Daily step" },
    { type: "other", label: "Diger" },
];

function uid() {
    return Math.random().toString(36).slice(2);
}

function makeExercise(): TargetExercise {
    return {
        id: uid(),
        name: "",
        targetSets: [{ targetReps: "10-15" }],
    };
}

export default function WarmupRoutineBuilderScreen() {
    const navigation = useNavigation<Navigation>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [days, setDays] = React.useState(route.params.days || []);
    const [activeDayIndex, setActiveDayIndex] = React.useState(route.params.initialDayIndex || 0);

    const activeDay = days[activeDayIndex] || days.find((day) => !day.isRestDay);
    const routine: WarmupRoutineTemplate = activeDay?.warmupRoutine || { exercises: [], cardioBlocks: [] };
    const exercises = routine.exercises || [];
    const cardioBlocks = routine.cardioBlocks || [];

    const updateRoutine = (patch: Partial<WarmupRoutineTemplate>) => {
        setDays((prev) =>
            prev.map((day, index) =>
                index === activeDayIndex
                    ? {
                        ...day,
                        warmupRoutine: {
                            ...(day.warmupRoutine || {}),
                            ...patch,
                        },
                    }
                    : day,
            ),
        );
    };

    const clearRoutine = () => updateRoutine({ exercises: [], cardioBlocks: [], steps: undefined });

    const addExercise = () => updateRoutine({ exercises: [...exercises, makeExercise()] });

    const updateExercise = (exerciseId: string, patch: Partial<TargetExercise>) => {
        updateRoutine({
            exercises: exercises.map((exercise) =>
                exercise.id === exerciseId ? { ...exercise, ...patch } : exercise,
            ),
        });
    };

    const updateExerciseSet = (exerciseId: string, targetReps: string) => {
        updateRoutine({
            exercises: exercises.map((exercise) =>
                exercise.id === exerciseId
                    ? { ...exercise, targetSets: [{ ...(exercise.targetSets[0] || {}), targetReps }] }
                    : exercise,
            ),
        });
    };

    const removeExercise = (exerciseId: string) => {
        updateRoutine({ exercises: exercises.filter((exercise) => exercise.id !== exerciseId) });
    };

    const addCardio = (type: CardioType, title: string) => {
        updateRoutine({
            cardioBlocks: [
                ...cardioBlocks,
                { id: uid(), type, title, totalDuration: 300 },
            ],
        });
    };

    const updateCardioDuration = (id: string, raw: string) => {
        const minutes = Number(raw.replace(",", ".")) || 0;
        updateRoutine({
            cardioBlocks: cardioBlocks.map((block) =>
                block.id === id ? { ...block, totalDuration: Math.max(0, Math.round(minutes * 60)) } : block,
            ),
        });
    };

    const removeCardio = (id: string) => {
        updateRoutine({ cardioBlocks: cardioBlocks.filter((block) => block.id !== id) });
    };

    const save = () => {
        const cleanedDays = days.map((day) => {
            const nextRoutine = day.warmupRoutine;
            const cleanExercises = (nextRoutine?.exercises || []).filter((exercise: TargetExercise) => exercise.name.trim());
            const cleanCardio = nextRoutine?.cardioBlocks || [];
            const hasRoutine = cleanExercises.length > 0 || cleanCardio.length > 0;
            return {
                ...day,
                warmupRoutine: hasRoutine
                    ? { exercises: cleanExercises, cardioBlocks: cleanCardio }
                    : undefined,
            };
        });
        navigation.navigate({
            name: "ProgramCreate",
            params: {
                ...(route.params.programCreateParams || {}),
                warmupRoutineResult: { days: cleanedDays },
            },
            merge: true,
        });
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Isinma Rutini Olustur</Text>
                <TouchableOpacity style={styles.iconBtn} onPress={save}>
                    <Ionicons name="checkmark" size={24} color={colors.accent} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.helperText}>
                    Bu rutin W setlerinden bagimsizdir. Antrenman gunu baslamadan once ayri loglanir.
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
                    {days.map((day, index) => {
                        if (day.isRestDay) return null;
                        const selected = index === activeDayIndex;
                        const hasRoutine = !!day.warmupRoutine?.exercises?.length || !!day.warmupRoutine?.cardioBlocks?.length;
                        return (
                            <TouchableOpacity
                                key={`${day.label}-${index}`}
                                style={[styles.dayChip, selected && styles.dayChipActive]}
                                onPress={() => setActiveDayIndex(index)}
                            >
                                <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]} numberOfLines={1}>
                                    {day.label || `Gun ${index + 1}`}
                                </Text>
                                {hasRoutine ? <View style={styles.dayDot} /> : null}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Hareketler</Text>
                            <Text style={styles.sectionDesc}>Rotator cuff, mobilite veya hafif aktivasyon hareketleri.</Text>
                        </View>
                        <TouchableOpacity style={styles.addBtn} onPress={addExercise}>
                            <Ionicons name="add" size={18} color={colors.background} />
                        </TouchableOpacity>
                    </View>

                    {exercises.map((exercise, index) => (
                        <View key={exercise.id} style={styles.exerciseCard}>
                            <View style={styles.exerciseTop}>
                                <Text style={styles.exerciseIndex}>{index + 1}</Text>
                                <TextInput
                                    style={styles.exerciseInput}
                                    value={exercise.name}
                                    onChangeText={(name) => updateExercise(exercise.id, { name })}
                                    placeholder="Orn. Cable external rotation"
                                    placeholderTextColor={colors.textMuted}
                                />
                                <TouchableOpacity onPress={() => removeExercise(exercise.id)} style={styles.smallIconBtn}>
                                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.repsInput}
                                value={exercise.targetSets[0]?.targetReps || ""}
                                onChangeText={(targetReps) => updateExerciseSet(exercise.id, targetReps)}
                                placeholder="Tekrar / sure hedefi: 12-15 veya 45 sn"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>
                    ))}
                    {exercises.length === 0 ? <Text style={styles.emptyText}>Bu gun icin isinma hareketi yok.</Text> : null}
                </View>

                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Kardiyo</Text>
                    <Text style={styles.sectionDesc}>Istersen hafif tempo kardiyo ekleyebilirsin.</Text>
                    <View style={styles.cardioTypeGrid}>
                        {CARDIO_TYPES.map((item) => (
                            <TouchableOpacity key={item.type} style={styles.cardioTypeChip} onPress={() => addCardio(item.type, item.label)}>
                                <Text style={styles.cardioTypeText}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    {cardioBlocks.map((block) => (
                        <View key={block.id} style={styles.cardioRow}>
                            <Text style={styles.cardioTitle}>{block.title}</Text>
                            <TextInput
                                style={styles.cardioDurationInput}
                                value={block.totalDuration ? String(Math.round(block.totalDuration / 60)) : ""}
                                onChangeText={(text) => updateCardioDuration(block.id, text)}
                                placeholder="dk"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                            />
                            <TouchableOpacity onPress={() => removeCardio(block.id)} style={styles.smallIconBtn}>
                                <Ionicons name="trash-outline" size={18} color={colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.clearBtn} onPress={clearRoutine}>
                    <Text style={styles.clearText}>Bu gunun rutinini temizle</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
                <AccentButton title="Rutini Kaydet" onPress={save} />
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md },
    iconBtn: { width: 42, height: 42, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    headerTitle: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    content: { padding: spacing.lg, paddingBottom: 120 },
    helperText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing.md },
    dayTabs: { gap: spacing.sm, paddingBottom: spacing.md },
    dayChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    dayChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    dayChipText: { color: colors.textSecondary, fontWeight: fontWeight.semibold },
    dayChipTextActive: { color: colors.accent },
    dayDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
    sectionCard: { padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.md },
    sectionTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    sectionDesc: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18, marginTop: 3 },
    addBtn: { width: 36, height: 36, borderRadius: borderRadius.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
    exerciseCard: { padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
    exerciseTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    exerciseIndex: { width: 24, color: colors.accent, fontWeight: fontWeight.bold, textAlign: "center" },
    exerciseInput: { flex: 1, minHeight: 42, color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, fontWeight: fontWeight.semibold },
    repsInput: { marginTop: spacing.sm, minHeight: 40, color: colors.text, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
    smallIconBtn: { width: 34, height: 34, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    emptyText: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
    cardioTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
    cardioTypeChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
    cardioTypeText: { color: colors.textSecondary, fontWeight: fontWeight.semibold },
    cardioRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, padding: spacing.sm, borderRadius: borderRadius.md, backgroundColor: colors.surfaceElevated },
    cardioTitle: { flex: 1, color: colors.text, fontWeight: fontWeight.bold },
    cardioDurationInput: { width: 74, minHeight: 38, color: colors.text, textAlign: "center", borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border },
    clearBtn: { alignSelf: "center", padding: spacing.md },
    clearText: { color: colors.error, fontWeight: fontWeight.semibold },
    footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
});
