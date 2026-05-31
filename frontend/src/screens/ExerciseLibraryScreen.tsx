import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "../data/exerciseLibrary";
import { useTheme } from "../hooks/ThemeContext";
import { COACH_PATTERN_LABELS, type CoachPatternKey } from "../services/coachRuleEngine";

const FILTERS = [
    { key: "all", label: "Tümü" },
    { key: "horizontal_adduction", label: "Göğüs" },
    { key: "upper_chest", label: "Üst göğüs" },
    { key: "shoulder_abduction", label: "Yan omuz" },
    { key: "shoulder_flexion", label: "Ön omuz" },
    { key: "shoulder_adduction", label: "Alt kanat" },
    { key: "shoulder_extension", label: "Üst kanat" },
    { key: "upper_back", label: "Üst sırt" },
    { key: "elbow_flexion", label: "Biceps" },
    { key: "elbow_extension", label: "Triceps" },
    { key: "leg_press", label: "Vastuslar" },
    { key: "knee_extension", label: "Quadriceps" },
    { key: "hip_hinge", label: "Hamstring/Glute" },
    { key: "knee_flexion", label: "Hamstring" },
    { key: "calf_raise", label: "Calf" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

function difficultyLabel(value: ExerciseLibraryItem["difficulty"]) {
    if (value === "beginner") return "Başlangıç";
    if (value === "advanced") return "İleri";
    return "Orta";
}

export default function ExerciseLibraryScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [filter, setFilter] = React.useState<FilterKey>("all");
    const [selected, setSelected] = React.useState<ExerciseLibraryItem | null>(null);

    const exercises = React.useMemo(() => {
        const filtered = filter === "all"
            ? EXERCISE_LIBRARY
            : EXERCISE_LIBRARY.filter((exercise) => exercise.pattern === filter);
        return [...filtered].sort((a, b) => Number(b.beginnerFriendly) - Number(a.beginnerFriendly));
    }, [filter]);

    return (
        <>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.eyebrow}>REHBER</Text>
                        <Text style={styles.title}>Egzersiz Kütüphanesi</Text>
                        <Text style={styles.subtitle}>
                            Hareketler SmartProgress paternlerine göre sınıflanır. Wizard da aynı kütüphaneden öneri üretir.
                        </Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    {FILTERS.map((item) => {
                        const active = filter === item.key;
                        return (
                            <TouchableOpacity
                                key={item.key}
                                style={[styles.filterChip, active && styles.filterChipActive]}
                                onPress={() => setFilter(item.key)}
                                activeOpacity={0.82}
                            >
                                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <View style={styles.list}>
                    {exercises.map((exercise) => (
                        <TouchableOpacity
                            key={exercise.id}
                            style={styles.card}
                            activeOpacity={0.84}
                            onPress={() => setSelected(exercise)}
                        >
                            <View style={styles.cardTop}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="barbell-outline" size={19} color={colors.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                                    <Text style={styles.exerciseMeta}>
                                        {COACH_PATTERN_LABELS[exercise.pattern as CoachPatternKey] || exercise.pattern} · {difficultyLabel(exercise.difficulty)}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                            </View>
                            <View style={styles.badgeRow}>
                                {exercise.beginnerFriendly && <Text style={styles.badge}>Başlangıç dostu</Text>}
                                {exercise.equipment.slice(0, 2).map((equipment) => (
                                    <Text key={equipment} style={styles.badge}>{equipment}</Text>
                                ))}
                            </View>
                            <Text style={styles.cardText} numberOfLines={2}>{exercise.coachNotes}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {selected && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalTitle}>{selected.name}</Text>
                                        <Text style={styles.modalSubtitle}>
                                            {COACH_PATTERN_LABELS[selected.pattern as CoachPatternKey] || selected.pattern} · {difficultyLabel(selected.difficulty)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity style={styles.modalClose} onPress={() => setSelected(null)}>
                                        <Ionicons name="close" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                    <DetailBlock title="Hedef kaslar" items={[...selected.primaryMuscles, ...selected.secondaryMuscles]} styles={styles} />
                                    <DetailBlock title="Nasıl yapılır" items={selected.instructions} styles={styles} />
                                    <DetailBlock title="Sık hatalar" items={selected.commonMistakes} styles={styles} warning />
                                    <View style={styles.noteBox}>
                                        <Ionicons name="bulb-outline" size={18} color={colors.accent} />
                                        <Text style={styles.noteText}>{selected.coachNotes}</Text>
                                    </View>
                                    {selected.aliases.length > 0 && (
                                        <Text style={styles.aliasText}>Eşleşmeler: {selected.aliases.slice(0, 5).join(", ")}</Text>
                                    )}
                                </ScrollView>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

function DetailBlock({ title, items, styles, warning = false }: { title: string; items: string[]; styles: any; warning?: boolean }) {
    if (!items.length) return null;
    return (
        <View style={styles.detailBlock}>
            <Text style={styles.detailTitle}>{title}</Text>
            {items.map((item) => (
                <View key={item} style={styles.detailItem}>
                    <Ionicons name={warning ? "alert-circle-outline" : "checkmark-circle-outline"} size={15} color={warning ? "#F5A524" : "#22C55E"} />
                    <Text style={styles.detailText}>{item}</Text>
                </View>
            ))}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
    header: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
    title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.xs },
    filterRow: { gap: spacing.sm, paddingVertical: spacing.xs },
    filterChip: {
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    filterText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    filterTextActive: { color: colors.accent },
    list: { gap: spacing.md },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    exerciseName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    exerciseMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    badge: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
    },
    cardText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.68)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    modalCard: {
        width: "100%",
        maxWidth: 520,
        maxHeight: "86%",
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
    },
    modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
    modalTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    modalSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    modalClose: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalScroll: { maxHeight: 520 },
    detailBlock: { gap: spacing.sm, marginBottom: spacing.lg },
    detailTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    detailItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    detailText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    noteBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    noteText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    aliasText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
});
