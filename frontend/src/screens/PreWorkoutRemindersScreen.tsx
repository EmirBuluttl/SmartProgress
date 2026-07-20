import React from "react";
import { ActivityIndicator, Animated, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authApi, programApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { ACTIVE_PROGRAM_KEY } from "../utils/workoutNavigation";
import NoticeModal from "../components/NoticeModal";
import { reschedulePreWorkoutRemindersForProgram } from "../services/localNotificationService";
import { KeyboardAwareScrollView } from "../components/KeyboardSafeScreen";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { clearOnboardingTrainingPending } from "../utils/appTourEvents";

type DayReminderDraft = { enabled?: boolean; note?: string };
type ProgramReminderDraft = {
    programName?: string;
    days?: Record<string, DayReminderDraft>;
};

export default function PreWorkoutRemindersScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "PreWorkoutReminders">>();
    const route = useRoute<RouteProp<RootStackParamList, "PreWorkoutReminders">>();
    const { user, updateUser } = useAuth();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const isTrainingMode = route.params?.trainingMode === "onboarding";

    const [loading, setLoading] = React.useState(true);
    const [programs, setPrograms] = React.useState<any[]>([]);
    const [activeProgramId, setActiveProgramId] = React.useState<string | null>(null);
    const [drafts, setDrafts] = React.useState<Record<string, ProgramReminderDraft>>({});
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);

    React.useEffect(() => {
        (async () => {
            try {
                const [programRes, activeId] = await Promise.all([
                    programApi.listMine(),
                    AsyncStorage.getItem(ACTIVE_PROGRAM_KEY),
                ]);
                const items = programRes.data.programs || [];
                setPrograms(items);
                setActiveProgramId(route.params?.programId || activeId || items[0]?.id || null);
                setDrafts(user?.settings?.pre_workout_reminders_by_program || {});
            } catch (error) {
                setNotice({ title: "Hatirlaticilar yuklenemedi", message: "Program bilgileri alinirken bir sorun olustu." });
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const activeProgram = programs.find((program) => program.id === activeProgramId) || programs[0] || null;
    const days = Array.isArray(activeProgram?.data?.days) ? activeProgram.data.days : [];
    const programDraft = activeProgram ? drafts[activeProgram.id] || {} : {};

    const updateDay = (dayIndex: number, patch: { enabled?: boolean; note?: string }) => {
        if (!activeProgram) return;
        setDrafts((prev) => {
            const programReminder = prev[activeProgram.id] || { programName: activeProgram.name, days: {} };
            const dayKey = String(dayIndex);
            return {
                ...prev,
                [activeProgram.id]: {
                    ...programReminder,
                    programName: activeProgram.name,
                    days: {
                        ...(programReminder.days || {}),
                        [dayKey]: {
                            ...((programReminder.days || {})[dayKey] || {}),
                            ...patch,
                        },
                    },
                },
            };
        });
    };

    const save = async () => {
        const settings = {
            ...user?.settings,
            pre_workout_reminders_by_program: drafts,
        };
        updateUser({ settings });
        try {
            await authApi.updateProfile({ settings });
            if (activeProgram && Array.isArray(activeProgram.data?.days)) {
                await reschedulePreWorkoutRemindersForProgram({
                    programId: activeProgram.id,
                    programName: activeProgram.name,
                    currentDayIndex: activeProgram.currentDayIndex || 0,
                    days: activeProgram.data.days,
                    reminders: drafts[activeProgram.id],
                });
            }
            if (isTrainingMode) {
                await clearOnboardingTrainingPending();
                navigation.replace("MainTabs");
                return;
            }
            setNotice({ title: "Kaydedildi", message: "Antrenman gunu hatirlaticilari guncellendi." });
        } catch (error) {
            setNotice({ title: "Kaydedilemedi", message: "Hatirlaticilar kaydedilirken bir sorun olustu." });
        }
    };

    const skipTraining = React.useCallback(async () => {
        await clearOnboardingTrainingPending();
        navigation.replace("MainTabs");
    }, [navigation]);

    return (
        <Animated.View style={[styles.container, { paddingTop: insets.top + spacing.lg }, animStyle]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Antrenman Hatirlaticilari</Text>
                <TouchableOpacity onPress={save} style={styles.saveBtn}>
                    <Text style={styles.saveText}>Kaydet</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
            ) : !activeProgram ? (
                <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>Aktif program yok</Text>
                    <Text style={styles.emptyText}>Gun bazli hatirlatici kurmak icin once bir programi aktif takip et.</Text>
                </View>
            ) : (
                <KeyboardAwareScrollView contentContainerStyle={styles.content} extraBottomPadding={150}>
                    {isTrainingMode ? (
                        <View style={styles.trainingCard}>
                            <View style={styles.trainingHeader}>
                                <Ionicons name="bulb-outline" size={20} color={colors.accent} />
                                <Text style={styles.trainingTitle}>Son adim: hatirlatici kur</Text>
                            </View>
                            <Text style={styles.trainingText}>
                                Antrenman gunune ozel not yazabilirsin. Ornegin ekipmani unutma, omuzu isit, protein tozunu hazirla veya formu bozma gibi kisa hatirlatmalar iyi calisir.
                            </Text>
                            <TouchableOpacity style={styles.trainingSkipBtn} onPress={skipTraining} activeOpacity={0.78}>
                                <Text style={styles.trainingSkipText}>Hatirlaticiyi atla</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <View style={styles.programCard}>
                        <Text style={styles.cardEyebrow}>Aktif Program</Text>
                        <Text style={styles.programName}>{activeProgram.name}</Text>
                        <Text style={styles.programHint}>Her gun icin farkli not yazabilirsin. Bu not sadece ilgili program gunu baslatilirken gosterilir.</Text>
                    </View>

                    {days.map((day: any, index: number) => {
                        if (day?.isRestDay) return null;
                        const dayReminder = programDraft.days?.[String(index)] || {};
                        return (
                            <View key={`${activeProgram.id}-${index}`} style={styles.dayCard}>
                                <View style={styles.dayHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.dayTitle}>{day.label || `Gun ${index + 1}`}</Text>
                                        <Text style={styles.daySubtitle}>{dayReminder.enabled ? "Baslamadan once gosterilir" : "Bu gun icin kapali"}</Text>
                                    </View>
                                    <Switch
                                        value={dayReminder.enabled === true}
                                        onValueChange={(enabled) => updateDay(index, { enabled })}
                                        trackColor={{ false: colors.surfaceElevated, true: colors.accentMuted }}
                                        thumbColor={dayReminder.enabled ? colors.accent : colors.textMuted}
                                    />
                                </View>
                                <TextInput
                                    style={styles.noteInput}
                                    value={dayReminder.note || ""}
                                    onChangeText={(note) => updateDay(index, { note })}
                                    placeholder="Orn. Omuz isindir, diz agrisini kontrol et, formu bozma..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>
                        );
                    })}
                </KeyboardAwareScrollView>
            )}

            <NoticeModal
                visible={!!notice}
                title={notice?.title || ""}
                message={notice?.message || ""}
                onClose={() => setNotice(null)}
            />
        </Animated.View>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: borderRadius.md, backgroundColor: colors.surface },
    headerTitle: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    saveBtn: { paddingHorizontal: spacing.md, minHeight: 40, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
    saveText: { color: colors.background, fontWeight: fontWeight.bold },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
    programCard: { padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    cardEyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: "uppercase" },
    programName: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginTop: spacing.xs },
    programHint: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.sm },
    trainingCard: { padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentMuted, gap: spacing.sm },
    trainingHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    trainingTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    trainingText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    trainingSkipBtn: { alignSelf: "flex-start", minHeight: 36, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" },
    trainingSkipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    dayCard: { padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    dayHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
    dayTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    daySubtitle: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    noteInput: { minHeight: 92, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, color: colors.text, padding: spacing.md, fontSize: fontSize.sm, lineHeight: 20 },
    emptyCard: { margin: spacing.lg, padding: spacing.xl, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    emptyText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.sm },
});
