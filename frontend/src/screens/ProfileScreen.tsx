// ─────────────────────────────────────────────
// ProfileScreen — User Settings & Programs
// Avatar, ayarlar, programlarım, PR'lar
// ─────────────────────────────────────────────
import React, { useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    Image,
    Alert,
    Dimensions,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { workoutApi, programApi, authApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { isCycleProgram } from "../types/workout";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";
import AccentButton from "../components/AccentButton";
import { confirmDialog } from "../utils/confirm";
import { calculateWorkoutLoadScore, countProgressEvents, getPersonalRecords } from "../utils/workoutMetrics";

const AVAILABLE_COLORS = [
    "#CCFF00", // Default Lime
    "#00F0FF", // Cyan
    "#FF0055", // Neon Pink
    "#FFB800", // Gold/Orange
    "#B026FF", // Purple
    "#00FF66", // Green
];

export default function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, logout, updateUser } = useAuth();
    const { colors, setAccentColor } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const heatmapStyles = React.useMemo(() => createHeatmapStyles(colors), [colors]);

    const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(
        user?.settings?.is_auto_suggest_enabled ?? true
    );
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);

    const [stats, setStats] = useState({ totalWorkouts: 0, currentStreak: 0, totalPRs: 5 });
    const [programs, setPrograms] = useState<any[]>([]);
    const [prs, setPrs] = useState<any[]>([]);
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const pickProfileImage = async () => {
        const getPickedImageUri = (asset: ImagePicker.ImagePickerAsset) =>
            asset.base64
                ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
                : asset.uri;

        const savePickedImage = async (uri: string) => {
            updateUser({ avatarUrl: uri, profileImage: uri });
            try {
                await authApi.updateProfile({ avatarUrl: uri });
            } catch (err) {
                console.warn("[Profile] Failed to persist profile image:", err);
            }
        };

        if (Platform.OS === "web") {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Ä°zin Gerekli", "LÃ¼tfen galeri iznini verin.");
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                await savePickedImage(getPickedImageUri(result.assets[0]));
            }
            return;
        }

        Alert.alert(
            "Profil Fotoğrafı",
            "Fotoğraf kaynağını seç",
            [
                {
                    text: "Kamera",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== "granted") {
                            Alert.alert("İzin Gerekli", "Lütfen kamera iznini verin.");
                            return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ["images"],
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                            base64: true,
                        });
                        if (!result.canceled && result.assets[0]) {
                            await savePickedImage(getPickedImageUri(result.assets[0]));
                        }
                    },
                },
                {
                    text: "Galeri",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== "granted") {
                            Alert.alert("İzin Gerekli", "Lütfen galeri iznini verin.");
                            return;
                        }
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ["images"],
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.8,
                            base64: true,
                        });
                        if (!result.canceled && result.assets[0]) {
                            await savePickedImage(getPickedImageUri(result.assets[0]));
                        }
                    },
                },
                { text: "İptal", style: "cancel" },
            ]
        );
    };

    const loadProfileData = async () => {
        try {
            const [userRes, progRes, workRes] = await Promise.all([
                authApi.getProfile(),
                programApi.listMine(),
                workoutApi.list({ limit: 50 })
            ]);

            if (userRes.data) {
                updateUser(userRes.data);
            }
            setPrograms(progRes.data.programs || []);

            const workouts = workRes.data.workouts || [];
            setWorkouts(workouts);

            const allPrs = getPersonalRecords(workouts);
            setPrs(allPrs.slice(0, 3));

            const streak = calculateStreak(workouts, progRes.data.programs || []);

            setStats({
                totalWorkouts: workouts.length || 0,
                currentStreak: streak,
                totalPRs: countProgressEvents(workouts)
            });
        } catch (error) {
            console.error("Profile Load Error", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            loadProfileData();
        }, [])
    );

    const handleLogout = async () => {
        const confirmed = await confirmDialog(
            "Çıkış Yap",
            "Hesabınızdan çıkmak istediğinize emin misiniz?",
        );
        if (!confirmed) return;
        await logout();
    };

    const firstName = user?.firstName || "Sporcu";
    const lastName = user?.lastName || "";
    const email = user?.email || "sporcu@smartprogress.com";

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* ─── Profile Header ─── */}
            <View style={styles.profileHeader}>
                <TouchableOpacity onPress={pickProfileImage} activeOpacity={0.85}>
                    <View style={styles.avatarLarge}>
                        {user?.avatarUrl || user?.profileImage ? (
                            <Image
                                source={{ uri: user.avatarUrl || user.profileImage }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.avatarLargeText}>
                                {firstName.charAt(0)}{lastName.charAt(0)}
                            </Text>
                        )}
                        <View style={styles.avatarEditBadge}>
                            <Ionicons name="camera" size={14} color={colors.background} />
                        </View>
                    </View>
                </TouchableOpacity>
                <Text style={styles.fullName}>{firstName} {lastName}</Text>
                <Text style={styles.email}>{email}</Text>
                <View style={styles.roleBadge}>
                    <Ionicons name="fitness-outline" size={14} color={colors.accent} />
                    <Text style={styles.roleBadgeText}>KULLANICI</Text>
                </View>
                <TouchableOpacity
                    style={styles.editProfileBtn}
                    onPress={() => (navigation as any).navigate("ProfileEdit")}
                >
                    <Text style={styles.editProfileBtnText}>Profili Düzenle</Text>
                </TouchableOpacity>
            </View>

            {/* ─── Quick Stats ─── */}
            <View style={styles.quickStats}>
                <View style={styles.quickStatItem}>
                    <Text style={styles.quickStatValue}>{stats.totalWorkouts}</Text>
                    <Text style={styles.quickStatLabel}>Antrenman</Text>
                </View>
                <View style={styles.quickStatDivider} />
                <View style={styles.quickStatItem}>
                    <Text style={styles.quickStatValue}>{stats.currentStreak}</Text>
                    <Text style={styles.quickStatLabel}>Gün Seri</Text>
                </View>
                <View style={styles.quickStatDivider} />
                <View style={styles.quickStatItem}>
                    <Text style={styles.quickStatValue}>{stats.totalPRs}</Text>
                    <Text style={styles.quickStatLabel}>Progress</Text>
                </View>
            </View>

            {/* ─── Activity Heatmap ─── */}
            <HeatmapCalendar workouts={workouts} colors={colors} heatmapStyles={heatmapStyles} />

            {/* ─── Settings ─── */}
            <SectionHeader title="⚙️ Ayarlar" />
            <GymCard style={styles.settingsCard}>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="sparkles" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Akıllı Öneri</Text>
                            <Text style={styles.settingDesc}>
                                Auto-Regulation ağırlık tahmini
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={autoSuggestEnabled}
                        onValueChange={async (val) => {
                            setAutoSuggestEnabled(val);
                            const newSettings = { ...user?.settings, is_auto_suggest_enabled: val };
                            updateUser({ settings: newSettings });
                            try {
                                await authApi.updateProfile({ settings: newSettings });
                            } catch (err) {
                                console.warn("[Profile] Failed to persist auto-suggest setting:", err);
                            }
                        }}
                        trackColor={{
                            false: colors.surfaceElevated,
                            true: colors.accentMuted,
                        }}
                        thumbColor={autoSuggestEnabled ? colors.accent : colors.textMuted}
                    />
                </View>

                <View style={styles.settingDivider} />

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Bildirimler</Text>
                            <Text style={styles.settingDesc}>Antrenman hatırlatıcıları</Text>
                        </View>
                    </View>
                    <Switch
                        value={notificationsEnabled}
                        onValueChange={setNotificationsEnabled}
                        trackColor={{
                            false: colors.surfaceElevated,
                            true: colors.accentMuted,
                        }}
                        thumbColor={notificationsEnabled ? colors.accent : colors.textMuted}
                    />
                </View>

                <View style={styles.settingDivider} />

                <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Tema Rengi</Text>
                            <Text style={styles.settingDesc}>Uygulama vurgu rengi</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Color Picker Row */}
                <View style={styles.colorPickerRow}>
                    {AVAILABLE_COLORS.map((hex) => {
                        const isSelected = colors.accent.toUpperCase() === hex.toUpperCase();
                        return (
                            <TouchableOpacity
                                key={hex}
                                style={[
                                    styles.colorSwatch,
                                    { backgroundColor: hex },
                                    isSelected && {
                                        borderWidth: 3,
                                        borderColor: colors.background,
                                        transform: [{ scale: 1.15 }]
                                    }
                                ]}
                                onPress={() => setAccentColor(hex)}
                                activeOpacity={0.8}
                            />
                        );
                    })}
                </View>
            </GymCard>

            {/* ─── My Programs ─── */}
            <SectionHeader
                title="📚 Programlarım"
                actionLabel="Tümü"
                onAction={() => navigation.navigate("ProgramList")}
            />
            {programs.length > 0 ? programs.map((prog, index) => (
                <TouchableOpacity
                    key={prog.id}
                    onPress={() => navigation.navigate("ProgramDetail", { programId: prog.id })}
                    style={styles.programCard}
                    activeOpacity={0.8}
                >
                    <GymCard style={styles.programCard}>
                        <View style={styles.programRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.programName}>{prog.name}</Text>
                                <Text style={styles.programDesc} numberOfLines={1}>
                                    {prog.description || "Açıklama yok"}
                                </Text>
                            </View>
                            <View
                                style={[
                                    styles.visibilityBadge,
                                    prog.isPublic
                                        ? styles.visibilityPublic
                                        : styles.visibilityPrivate,
                                ]}
                            >
                                <Ionicons
                                    name={prog.isPublic ? "globe-outline" : "lock-closed-outline"}
                                    size={12}
                                    color={prog.isPublic ? colors.accent : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.visibilityText,
                                        prog.isPublic
                                            ? styles.visibilityTextPublic
                                            : styles.visibilityTextPrivate,
                                    ]}
                                >
                                    {prog.isPublic ? "Public" : "Private"}
                                </Text>
                            </View>
                        </View>
                    </GymCard>
                </TouchableOpacity>
            )) : (
                <Text style={{ color: colors.textMuted, fontStyle: "italic", marginBottom: spacing.lg }}>Henüz programınız yok.</Text>
            )}

            {/* ─── Personal Records ─── */}
            <SectionHeader title="🏆 Rekorlarım" actionLabel="Tümü" onAction={() => (navigation as any).navigate("Records")} />
            <GymCard style={styles.prList}>
                {prs.length > 0 ? prs.map((pr, index) => (
                    <View key={index}>
                        <View style={styles.prRow}>
                            <Ionicons name="trophy" size={18} color={colors.warning} />
                            <Text style={styles.prExercise}>{pr.exercise}</Text>
                            <Text style={styles.prWeight}>
                                {pr.weight} {pr.unit} x {pr.reps}
                            </Text>
                        </View>
                        {index < prs.length - 1 && <View style={styles.prDivider} />}
                    </View>
                )) : (
                    <Text style={{ color: colors.textSecondary, fontStyle: "italic" }}>Görüntülenecek rekor yok.</Text>
                )}
            </GymCard>

            {/* ─── Logout ─── */}
            <AccentButton
                title="Çıkış Yap"
                variant="outline"
                onPress={handleLogout}
                style={styles.logoutBtn}
            />

            <View style={{ height: spacing.xxxl }} />
        </ScrollView>
    );
}

// ─── Heatmap Component ───────────────────────────────

const SCREEN_W = Dimensions.get("window").width;
const HEATMAP_WEEKS = 26; // 6 months
const CELL_GAP = 2;
const CELL_SIZE = Math.floor((SCREEN_W - 32 - 24 - (HEATMAP_WEEKS - 1) * CELL_GAP) / HEATMAP_WEEKS);



function volumeToHeat(volume: number, maxVolume: number): number {
    if (volume === 0 || maxVolume === 0) return 0;
    const ratio = volume / maxVolume;
    if (ratio < 0.1) return 1;
    if (ratio < 0.3) return 2;
    if (ratio < 0.6) return 3;
    if (ratio < 0.85) return 4;
    return 5;
}

function HeatmapCalendar({ workouts, colors, heatmapStyles }: { workouts: any[], colors: any, heatmapStyles: any }) {
    const HEAT_COLORS = [
        colors.surfaceLight, // 0 = empty
        colors.accent + "40", // 1 = light
        colors.accent + "80", // 2 = medium
        colors.accent + "C0", // 3 = high
        colors.accent,        // 4 = very high
        "#CCFF00",  // 5 — peak
    ];

    // Build date -> volume map
    const volumeMap = new Map<string, number>();
    workouts.forEach((w) => {
        const dateStr = w.logDate?.split("T")?.[0] ?? "";
        if (!dateStr) return;
        const vol = calculateWorkoutLoadScore(w);
        volumeMap.set(dateStr, (volumeMap.get(dateStr) ?? 0) + vol);
    });

    const maxVolume = Math.max(0, ...Array.from(volumeMap.values()));

    // Build a 26-week grid (Mon–Sun columns, weeks as columns)
    const today = new Date();
    const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

    // Start from 26 weeks ago, aligned to Monday
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - HEATMAP_WEEKS * 7);
    // Align to Mon
    const dow = startDate.getDay(); // 0=Sun
    const daysBack = dow === 0 ? 6 : dow - 1;
    startDate.setDate(startDate.getDate() - daysBack);

    // Build weeks array: each week is array of 7 dates (Mon-Sun)
    const weeks: Date[][] = [];
    const cur = new Date(startDate);
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }
        weeks.push(week);
    }

    return (
        <View style={heatmapStyles.container}>
            <Text style={heatmapStyles.title}>📅 Aktivite Takvimi</Text>
            <Text style={heatmapStyles.subtitle}>Son 6 ay · yük skoru yoğunluğu</Text>

            <View style={heatmapStyles.grid}>
                {/* Day labels column */}
                <View style={heatmapStyles.dayLabels}>
                    {DAY_LABELS.map((d, i) => (
                        <Text key={i} style={heatmapStyles.dayLabel}>{i % 2 === 0 ? d : ""}</Text>
                    ))}
                </View>

                {/* Week columns */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: CELL_GAP }}>
                        {weeks.map((week, wi) => (
                            <View key={wi} style={{ flexDirection: "column", gap: CELL_GAP }}>
                                {week.map((date, di) => {
                                    const iso = date.toISOString().split("T")[0];
                                    const vol = volumeMap.get(iso) ?? 0;
                                    const heat = volumeToHeat(vol, maxVolume);
                                    const isFuture = date > today;
                                    return (
                                        <View
                                            key={di}
                                            style={[
                                                heatmapStyles.cell,
                                                {
                                                    backgroundColor: isFuture
                                                        ? colors.surfaceElevated
                                                        : HEAT_COLORS[heat],
                                                    opacity: isFuture ? 0.3 : 1,
                                                },
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Legend */}
            <View style={heatmapStyles.legend}>
                <Text style={heatmapStyles.legendLabel}>Az</Text>
                {HEAT_COLORS.map((c, i) => (
                    <View key={i} style={[heatmapStyles.legendCell, { backgroundColor: c }]} />
                ))}
                <Text style={heatmapStyles.legendLabel}>Çok</Text>
            </View>
        </View>
    );
}

// ─── Helpers ────────────────────────────────
function calculateStreak(workouts: any[], programs: any[] = []): number {
    if (!workouts.length) return 0;

    // Create a Set of all dates the user worked out
    const workedOutDates = new Set(workouts.map((w) => new Date(w.logDate).toDateString()));
    let streak = 0;
    const today = new Date();

    // Determine which days of the week are usually rest days based on the user's active/favorite program
    // If no program, assume no rest days
    let restDaysOfWeek = new Set<number>(); // 0 = Sunday, 1 = Monday, etc.
    if (programs.length > 0) {
        // Pick the first cycle program to extract rest days
        const cycleProg = programs.find(p => isCycleProgram(p.data));
        if (cycleProg) {
            cycleProg.data.days.forEach((day: any, index: number) => {
                if (day.isRestDay) {
                    if (cycleProg.data.frequency === 7) {
                        let dotw = (index + 1) % 7;
                        restDaysOfWeek.add(dotw);
                    }
                }
            });
        }
    }

    for (let i = 0; i < 365; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const dayString = day.toDateString();

        if (workedOutDates.has(dayString)) {
            streak++;
        } else if (i === 0) {
            continue;
        } else if (restDaysOfWeek.has(day.getDay())) {
            continue;
        } else {
            break;
        }
    }
    return streak;
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl + spacing.xl,
        paddingBottom: spacing.xxxl,
    },
    profileHeader: {
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.accentMuted,
        borderWidth: 3,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.md,
    },
    avatarLargeText: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    avatarImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    avatarEditBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    fullName: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    email: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    roleBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
    },
    roleBadgeText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        color: colors.accent,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    editProfileBtn: {
        marginTop: spacing.sm,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    editProfileBtnText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    quickStats: {
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.xxl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickStatItem: {
        flex: 1,
        alignItems: "center",
    },
    quickStatValue: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
        marginBottom: 2,
    },
    quickStatLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    quickStatDivider: {
        width: 1,
        backgroundColor: colors.border,
        marginHorizontal: spacing.md,
    },
    settingsCard: {
        marginBottom: spacing.xxl,
    },
    settingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
    },
    settingInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: spacing.md,
    },
    settingIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.surfaceElevated,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    settingTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        color: colors.text,
    },
    settingDesc: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    settingDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.sm,
    },
    programCard: {
        marginBottom: spacing.sm,
    },
    programRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    programName: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
        color: colors.text,
    },
    programDesc: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    visibilityBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.sm,
        gap: 4,
        marginLeft: spacing.sm,
    },
    visibilityPublic: {
        backgroundColor: colors.accentMuted,
    },
    visibilityPrivate: {
        backgroundColor: colors.surfaceElevated,
    },
    visibilityText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    visibilityTextPublic: {
        color: colors.accent,
    },
    visibilityTextPrivate: {
        color: colors.textSecondary,
    },
    prList: {
        marginBottom: spacing.xxl,
    },
    prRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.sm,
        gap: spacing.md,
    },
    prExercise: {
        flex: 1,
        fontSize: fontSize.md,
        color: colors.text,
        fontWeight: fontWeight.medium,
    },
    prWeight: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    prDivider: {
        height: 1,
        backgroundColor: colors.border,
    },
    logoutBtn: {
        marginTop: spacing.md,
    },
    colorPickerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
    },
    colorSwatch: {
        width: 32,
        height: 32,
        borderRadius: 16,
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
});

const createHeatmapStyles = (colors: any) => StyleSheet.create({
    container: {
        marginBottom: spacing.xxl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: fontSize.xs,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    grid: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    dayLabels: {
        flexDirection: "column",
        gap: CELL_GAP,
        marginRight: CELL_GAP + 2,
        paddingTop: 0,
    },
    dayLabel: {
        height: CELL_SIZE,
        fontSize: 8,
        color: colors.textMuted,
        textAlignVertical: "center",
        lineHeight: CELL_SIZE,
    },
    cell: {
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 2,
    },
    legend: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        marginTop: spacing.sm,
        gap: 3,
    },
    legendCell: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legendLabel: {
        fontSize: 9,
        color: colors.textMuted,
        marginHorizontal: 2,
    },
});
