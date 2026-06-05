import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import ActionConfirmModal from "../components/ActionConfirmModal";
import {
    activateProgramForWorkout,
    buildPreviewWorkoutParams,
    buildTrackedWorkoutParams,
    getActiveProgramId,
    navigateToWorkoutRespectingActiveSession,
} from "../utils/workoutNavigation";
import { useScreenEnter } from "../hooks/useScreenEnter";

type Route = RouteProp<RootStackParamList, "ProgramDayDetail">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ProgramDayDetailScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { programId, programName, dayIndex, day, programData } = route.params;
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const [inactiveStartModalVisible, setInactiveStartModalVisible] = React.useState(false);

    const programToStart = React.useMemo(() => ({
        id: programId,
        name: programName,
        data: programData,
    }), [programData, programId, programName]);

    const startDay = async () => {
        const activeProgramId = await getActiveProgramId();

        if (activeProgramId !== programId) {
            setInactiveStartModalVisible(true);
            return;
        }

        navigateToWorkoutRespectingActiveSession(navigation, {
            programId,
            programName,
            dayIndex,
            programData,
        });
    };

    const startAsActive = async () => {
        setInactiveStartModalVisible(false);
        await activateProgramForWorkout(programId);
        navigateToWorkoutRespectingActiveSession(navigation, buildTrackedWorkoutParams(programToStart, 0));
    };

    const startWithoutTracking = () => {
        setInactiveStartModalVisible(false);
        navigateToWorkoutRespectingActiveSession(navigation, buildPreviewWorkoutParams(programToStart, dayIndex));
    };

    return (
        <Animated.View style={[styles.root, animStyle]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={1}>{day.label || `Gün ${dayIndex + 1}`}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{programName}</Text>
                </View>
                <View style={styles.headerButton} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {day.isRestDay ? (
                    <GymCard style={styles.emptyCard}>
                        <Ionicons name="bed-outline" size={34} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>Dinlenme günü</Text>
                        <Text style={styles.emptyText}>Bu gün programda dinlenme olarak tanımlanmış.</Text>
                    </GymCard>
                ) : day.exercises.length > 0 ? (
                    day.exercises.map((exercise, exIndex) => (
                        <GymCard key={exercise.id || `${exercise.name}-${exIndex}`} elevated style={styles.exerciseCard}>
                            <View style={styles.exerciseHeader}>
                                <View style={styles.exerciseIndex}>
                                    <Text style={styles.exerciseIndexText}>{exIndex + 1}</Text>
                                </View>
                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                            </View>

                            {exercise.targetSets.map((set, setIndex) => {
                                const label = getSetLabel(exercise.targetSets, setIndex);
                                return (
                                    <View key={setIndex} style={[styles.setRow, set.isWarmup && styles.warmupSetRow]}>
                                        <Text style={[styles.setLabel, set.isWarmup && styles.warmupSetLabel]}>{label}</Text>
                                        <Text style={styles.setValue}>
                                            {set.targetWeight ? `${set.targetWeight} kg · ` : ""}
                                            {set.targetReps || "-"} tekrar
                                        </Text>
                                        {(set.targetRPE || set.targetRIR) && (
                                            <Text style={styles.setMeta}>
                                                {set.targetRPE ? `RPE ${set.targetRPE}` : ""}
                                                {set.targetRPE && set.targetRIR ? " · " : ""}
                                                {set.targetRIR ? `RIR ${set.targetRIR}` : ""}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })}
                        </GymCard>
                    ))
                ) : (
                    <GymCard style={styles.emptyCard}>
                        <Ionicons name="barbell-outline" size={34} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>Egzersiz yok</Text>
                        <Text style={styles.emptyText}>Bu gün için henüz egzersiz tanımlanmamış.</Text>
                    </GymCard>
                )}
                <View style={{ height: 110 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.startButton} onPress={startDay} activeOpacity={0.86}>
                    <Ionicons name="play" size={18} color={colors.background} />
                    <Text style={styles.startText}>Bu Günü Başlat</Text>
                </TouchableOpacity>
            </View>
            <ActionConfirmModal
                visible={inactiveStartModalVisible}
                title="Bu program takipte degil"
                message="Programi aktif hale getirirsen onceki aktif programin gun sirasi sifirlanir ve bu program ilk gunden takibe alinir. Istersen sadece bu gunu takip akisini degistirmeden baslatabilirsin."
                primaryLabel="Aktif yap ve baslat"
                secondaryLabel="Sadece bu gunu baslat"
                onPrimary={startAsActive}
                onSecondary={startWithoutTracking}
                onDismiss={() => setInactiveStartModalVisible(false)}
            />
        </Animated.View>
    );
}

function getSetLabel(sets: { isWarmup?: boolean }[], setIndex: number): string {
    const set = sets[setIndex];
    const sameTypeBefore = sets.slice(0, setIndex + 1).filter((candidate) => !!candidate.isWarmup === !!set.isWarmup).length;
    return set.isWarmup ? `W${sameTypeBefore}` : `${sameTypeBefore}`;
}

const createStyles = (colors: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 50,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    headerText: { flex: 1, alignItems: "center" },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.md },
    exerciseCard: { gap: spacing.md },
    exerciseHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    exerciseIndex: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    exerciseIndexText: { color: colors.accent, fontWeight: fontWeight.bold, fontSize: fontSize.sm },
    exerciseName: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    setRow: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    warmupSetRow: {
        opacity: 0.82,
        borderColor: colors.borderLight,
    },
    setLabel: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 4 },
    warmupSetLabel: { color: colors.textMuted, fontStyle: "italic" },
    setValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
    setMeta: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4 },
    emptyCard: {
        alignItems: "center",
        gap: spacing.sm,
        paddingVertical: spacing.xxl,
    },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    emptyText: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: "center" },
    footer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    startButton: {
        minHeight: 52,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    startText: { color: colors.background, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
