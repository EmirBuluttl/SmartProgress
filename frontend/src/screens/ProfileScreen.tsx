// ─────────────────────────────────────────────
// ProfileScreen — User Settings & Programs
// Avatar, ayarlar, programlarım, PR'lar
// ─────────────────────────────────────────────
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Animated,
    StyleSheet,
    Switch,
    TouchableOpacity,
    Image,
    Dimensions,
    Platform,
    Modal,
    Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { workoutApi, programApi, authApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";
import AccentButton from "../components/AccentButton";
import AnimatedPressable from "../components/AnimatedPressable";
import NoticeModal from "../components/NoticeModal";
import { requestAppTourReplay } from "../utils/appTourEvents";
import { navigateWithFeedback, NavigationFeedbackVariant } from "../utils/navigationFeedback";
import ActionConfirmModal from "../components/ActionConfirmModal";
import { confirmDialog } from "../utils/confirm";
import { calculateWorkoutLoadScore, countProgressEvents, getPersonalRecords } from "../utils/workoutMetrics";
import { calculateWorkoutStreak } from "../utils/streak";
import { useScreenEnter } from "../hooks/useScreenEnter";

const ACTIVE_PROGRAM_KEY = "active_program_id";
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || "https://app.smartprogress.online/privacy";
const SUPPORT_URL = process.env.EXPO_PUBLIC_SUPPORT_URL || "https://app.smartprogress.online/support";
const ACCOUNT_DELETION_URL = process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL || "https://app.smartprogress.online/account-deletion";

const AVAILABLE_COLORS = [
    "#3B82F6", // Blue
    "#CCFF00", // Default Lime
    "#0F172A", // Navy
    "#00F0FF", // Cyan
    "#FF0055", // Neon Pink
    "#FFB800", // Gold/Orange
    "#B026FF", // Purple
    "#00FF66", // Green
    "#7DD3FC", // Soft Sky
    "#A7F3D0", // Soft Mint
    "#F9A8D4", // Soft Rose
    "#C4B5FD", // Soft Violet
    "#FDBA74", // Soft Apricot
    "#99F6E4", // Soft Teal
];

const TRAINING_LEVEL_OPTIONS = [
    { key: "beginner", label: "Baslangic" },
    { key: "intermediate", label: "Orta" },
    { key: "advanced", label: "Ileri" },
] as const;

type TrainingLevel = typeof TRAINING_LEVEL_OPTIONS[number]["key"];

export default function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, logout, updateUser } = useAuth();
    const { colors, themeMode, setAccentColor, setThemeMode } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const heatmapStyles = React.useMemo(() => createHeatmapStyles(colors), [colors]);
    const { animStyle } = useScreenEnter();
    const navigateStatic = React.useCallback(
        (screen: keyof RootStackParamList, variant: NavigationFeedbackVariant = "detail") =>
            navigateWithFeedback(() => navigation.navigate(screen as any), { variant }),
        [navigation],
    );

    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [rememberRepsEnabled, setRememberRepsEnabled] = useState(
        user?.settings?.remember_reps_enabled === true
    );
    const [profilePublic, setProfilePublic] = useState(
        user?.settings?.profile_visibility === "public"
    );
    const [trainingLevel, setTrainingLevel] = useState<TrainingLevel>(
        (user?.settings?.training_level as TrainingLevel) || "beginner"
    );
    const [showRpeRirInfo, setShowRpeRirInfo] = useState(
        user?.settings?.show_rpe_rir_info !== false
    );
    const [preWorkoutReminderNote, setPreWorkoutReminderNote] = useState(
        user?.settings?.pre_workout_reminder_note || ""
    );
    const [themePickerVisible, setThemePickerVisible] = useState(false);
    const [rememberInfoVisible, setRememberInfoVisible] = useState(false);
    const [reminderModalVisible, setReminderModalVisible] = useState(false);
    const [reminderDraft, setReminderDraft] = useState("");
    const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
    const [photoSourceVisible, setPhotoSourceVisible] = useState(false);
    const [deleteAccountPending, setDeleteAccountPending] = useState(false);

    const [stats, setStats] = useState({ totalWorkouts: 0, currentStreak: 0, totalPRs: 5 });
    const [programs, setPrograms] = useState<any[]>([]);
    const [prs, setPrs] = useState<any[]>([]);
    const [workouts, setWorkouts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        setTrainingLevel((user?.settings?.training_level as TrainingLevel) || "beginner");
    }, [user?.settings?.training_level]);

    const persistSettings = async (patch: Record<string, any>, warningLabel: string) => {
        const newSettings = { ...user?.settings, ...patch };
        updateUser({ settings: newSettings });
        try {
            await authApi.updateProfile({ settings: newSettings });
        } catch (err) {
            console.warn(`[Profile] Failed to persist ${warningLabel}:`, err);
        }
    };

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
                setNotice({
                    title: "İzin Gerekli",
                    message: "Profil fotoğrafını değiştirmek için galeri izni vermen gerekiyor.",
                });
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

        setPhotoSourceVisible(true);
    };

    const pickProfileImageFromSource = async (source: "camera" | "gallery") => {
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

        const permission = source === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permission.status !== "granted") {
            setNotice({
                title: "Izin gerekli",
                message: source === "camera"
                    ? "Profil fotografi cekmek icin kamera izni vermen gerekiyor."
                    : "Profil fotografi secmek icin galeri izni vermen gerekiyor.",
            });
            return;
        }

        const result = source === "camera"
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });

        if (!result.canceled && result.assets[0]) {
            await savePickedImage(getPickedImageUri(result.assets[0]));
        }
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

            const activeProgramId = await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY);
            const streak = calculateWorkoutStreak(workouts, progRes.data.programs || [], activeProgramId);

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

    const openExternal = async (url: string, title: string) => {
        try {
            await Linking.openURL(url);
        } catch {
            setNotice({ title: "Açılamadı", message: `${title} bağlantısı açılamadı.` });
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteAccountPending(false);
        try {
            await authApi.deleteAccount();
            await logout();
        } catch {
            setNotice({
                title: "Hesap silinemedi",
                message: "Hesap ve veriler silinirken bir sorun oluştu. Lütfen destek ile iletişime geç.",
            });
        }
    };

    const firstName = user?.firstName || "Sporcu";
    const lastName = user?.lastName || "";
    const email = user?.email || "sporcu@smartprogress.com";
    const programUsageDays = React.useMemo(() => {
        const usage = new Map<string, Set<string>>();
        workouts.forEach((workout: any) => {
            const programId = String(workout?.programId || workout?.data?.programId || "").trim();
            const date = String(workout?.logDate || "").slice(0, 10);
            if (!programId || !date) return;
            if (!usage.has(programId)) usage.set(programId, new Set());
            usage.get(programId)?.add(date);
        });
        return usage;
    }, [workouts]);
    const topPrograms = React.useMemo(
        () => [...programs]
            .sort((a, b) => (programUsageDays.get(b.id)?.size || 0) - (programUsageDays.get(a.id)?.size || 0))
            .slice(0, 3),
        [programs, programUsageDays],
    );

    return (
        <>
        <Animated.ScrollView
            style={[styles.container, animStyle]}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
            showsVerticalScrollIndicator={false}
        >
            {/* ─── Profile Header ─── */}
            <View style={styles.profileHeader}>
                <AnimatedPressable style={styles.avatarPressable} onPress={pickProfileImage} pressedScale={0.96}>
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
                </AnimatedPressable>
                <Text style={styles.fullName}>{firstName} {lastName}</Text>
                <Text style={styles.email}>{email}</Text>
                <AnimatedPressable
                    style={styles.editProfileBtn}
                    onPress={() => navigateStatic("ProfileEdit", "modal")}
                    pressedScale={0.97}
                >
                    <Text style={styles.editProfileBtnText}>Profili Düzenle</Text>
                </AnimatedPressable>
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

            <SectionHeader title="Takip" />
            <GymCard style={styles.settingsCard}>
                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.75}
                    onPress={() => navigateStatic("BodyMeasurements")}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="body-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Vücut Ölçüleri</Text>
                            <Text style={styles.settingDesc}>Kilo, bel, kol ve diğer ölçülerini takip et</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
                <View style={styles.settingDivider} />
                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.75}
                    onPress={() => navigateStatic("Nutrition")}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="nutrition-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Kalori ve Makro</Text>
                            <Text style={styles.settingDesc}>Günlük kalori, protein, karbonhidrat ve yağ takibi</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </GymCard>

            {/* ─── Settings ─── */}
            <SectionHeader title="Ayarlar" />
            <GymCard style={styles.settingsCard}>
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

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => navigateStatic("PreWorkoutReminders")}
                    activeOpacity={0.78}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="clipboard-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Antrenman Gunu Hatirlaticilari</Text>
                            <Text style={styles.settingDesc} numberOfLines={2}>
                                Aktif programindaki her gun icin ayri antrenman oncesi not kur
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => navigateStatic("TrainingLevel")}
                    activeOpacity={0.78}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="speedometer-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Kullanici Seviyesi</Text>
                            <Text style={styles.settingDesc}>
                                Secili seviye: {TRAINING_LEVEL_OPTIONS.find((option) => option.key === trainingLevel)?.label || "Baslangic"}
                            </Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => {
                        requestAppTourReplay();
                        navigateWithFeedback(() => (navigation as any).navigate("MainTabs", { screen: "Home", switchKey: Date.now() }));
                    }}
                    activeOpacity={0.78}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="play-circle-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Uygulama Turunu Tekrar Izle</Text>
                            <Text style={styles.settingDesc}>Ana akisi, MyProgress'i, kocu ve profil ayarlarini tekrar tanit</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => navigateStatic("PremiumDetail")}
                    activeOpacity={0.78}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="card-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Premium Aboneliği</Text>
                            <Text style={styles.settingDesc}>Store trial, satın alma ve restore işlemlerini yönet</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>RPE/RIR Bilgi Butonlari</Text>
                            <Text style={styles.settingDesc}>Loglama ve program ekranlarinda kucuk aciklama ikonlarini goster</Text>
                        </View>
                    </View>
                    <Switch
                        value={showRpeRirInfo}
                        onValueChange={(val) => {
                            setShowRpeRirInfo(val);
                            persistSettings({ show_rpe_rir_info: val }, "RPE/RIR info setting");
                        }}
                        trackColor={{
                            false: colors.surfaceElevated,
                            true: colors.accentMuted,
                        }}
                        thumbColor={showRpeRirInfo ? colors.accent : colors.textMuted}
                    />
                </View>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.75}
                    onPress={() => navigateStatic("ExerciseLibrary")}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="library-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Egzersiz Kütüphanesi</Text>
                            <Text style={styles.settingDesc}>Kas grubu, ekipman ve seviye bazlı hareket rehberi</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="repeat-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <View style={styles.settingTitleRow}>
                                <Text style={styles.settingTitle}>Tekrarlarımı Hatırla</Text>
                                <TouchableOpacity onPress={() => setRememberInfoVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="information-circle-outline" size={17} color={colors.accent} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.settingDesc}>Açıkken placeholder son log tekrarını önceliklendirir</Text>
                        </View>
                    </View>
                    <Switch
                        value={rememberRepsEnabled}
                        onValueChange={async (val) => {
                            setRememberRepsEnabled(val);
                            persistSettings({ remember_reps_enabled: val }, "remember reps setting");
                        }}
                        trackColor={{
                            false: colors.surfaceElevated,
                            true: colors.accentMuted,
                        }}
                        thumbColor={rememberRepsEnabled ? colors.accent : colors.textMuted}
                    />
                </View>

                <View style={styles.settingDivider} />

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name={profilePublic ? "globe-outline" : "lock-closed-outline"} size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Profil Görünürlüğü</Text>
                            <Text style={styles.settingDesc}>
                                {profilePublic ? "Public profil hazırlığı açık" : "Profilin varsayılan olarak gizli"}
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={profilePublic}
                        onValueChange={async (val) => {
                            setProfilePublic(val);
                            persistSettings({ profile_visibility: val ? "public" : "private" }, "profile visibility");
                        }}
                        trackColor={{
                            false: colors.surfaceElevated,
                            true: colors.accentMuted,
                        }}
                        thumbColor={profilePublic ? colors.accent : colors.textMuted}
                    />
                </View>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.7}
                    onPress={() => setThemePickerVisible(true)}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="moon-outline" size={20} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Tema Rengi</Text>
                            <Text style={styles.settingDesc}>Uygulama vurgu rengi</Text>
                        </View>
                    </View>
                    <View style={[styles.currentColorDot, { backgroundColor: colors.accent }]} />
                </TouchableOpacity>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name={themeMode === "dark" ? "moon-outline" : "sunny-outline"} size={20} color={colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Tema Modu</Text>
                            <Text style={styles.settingDesc}>Koyu veya acik gorunum</Text>
                        </View>
                    </View>
                    <View style={styles.themeModeToggle}>
                        <TouchableOpacity
                            style={[styles.themeModeOption, themeMode === "dark" && styles.themeModeOptionActive]}
                            onPress={() => setThemeMode("dark")}
                            activeOpacity={0.82}
                        >
                            <Ionicons name="moon-outline" size={14} color={themeMode === "dark" ? colors.background : colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.themeModeOption, themeMode === "light" && styles.themeModeOptionActive]}
                            onPress={() => setThemeMode("light")}
                            activeOpacity={0.82}
                        >
                            <Ionicons name="sunny-outline" size={14} color={themeMode === "light" ? colors.background : colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.78}
                    onPress={() => openExternal(PRIVACY_URL, "Gizlilik politikası")}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Gizlilik Politikası</Text>
                            <Text style={styles.settingDesc}>Verilerin nasıl işlendiğini ve saklandığını görüntüle</Text>
                        </View>
                    </View>
                    <Ionicons name="open-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.78}
                    onPress={() => openExternal(SUPPORT_URL, "Destek")}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="help-buoy-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Destek</Text>
                            <Text style={styles.settingDesc}>Abonelik, hesap ve veri talepleri için destek al</Text>
                        </View>
                    </View>
                    <Ionicons name="open-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.78}
                    onPress={() => openExternal(ACCOUNT_DELETION_URL, "Hesap silme sayfası")}
                >
                    <View style={styles.settingInfo}>
                        <View style={styles.settingIconWrap}>
                            <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Veri Silme Web Yolu</Text>
                            <Text style={styles.settingDesc}>Uygulamaya erişemeyen kullanıcılar için hesap silme kaynağı</Text>
                        </View>
                    </View>
                    <Ionicons name="open-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.settingDivider} />

                <TouchableOpacity
                    style={styles.settingRow}
                    activeOpacity={0.78}
                    onPress={() => setDeleteAccountPending(true)}
                >
                    <View style={styles.settingInfo}>
                        <View style={[styles.settingIconWrap, { borderColor: colors.error, backgroundColor: `${colors.error}12` }]}>
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingTitle, { color: colors.error }]}>Hesabı ve Verileri Sil</Text>
                            <Text style={styles.settingDesc}>Hesabın ve ilişkili antrenman/program verilerin kalıcı olarak silinir</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </GymCard>

            {/* ─── My Programs ─── */}
            <SectionHeader
                title="Programlarım"
                actionLabel="Tümü"
                onAction={() => navigateStatic("ProgramList")}
            />
            {topPrograms.length > 0 ? topPrograms.map((prog, index) => (
                <TouchableOpacity
                    key={prog.id}
                    onPress={() => navigateWithFeedback(() => navigation.navigate("ProgramDetail", { programId: prog.id }))}
                    style={styles.programCard}
                    activeOpacity={0.8}
                >
                    <GymCard style={styles.programCard}>
                        <View style={styles.programRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.programName}>{prog.name}</Text>
                                <Text style={styles.programDesc} numberOfLines={1}>
                                    {(programUsageDays.get(prog.id)?.size || 0) > 0 ? `${programUsageDays.get(prog.id)?.size || 0} gündür kullanılıyor` : prog.description || "Açıklama yok"}
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
            <SectionHeader title="En İyi Setlerim" actionLabel="Tümü" onAction={() => navigateWithFeedback(() => (navigation as any).navigate("Records"))} />
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
        </Animated.ScrollView>
        <Modal
            visible={themePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setThemePickerVisible(false)}
        >
            <View style={styles.themeModalOverlay}>
                <View style={styles.themeModalCard}>
                    <View style={styles.modalAccentBar} />
                    <Text style={styles.themeModalTitle}>Tema Rengi</Text>
                    <Text style={styles.themeModalDesc}>Uygulamanın vurgu rengini seç</Text>
                    <View style={styles.colorPickerGrid}>
                        {AVAILABLE_COLORS.map((hex) => {
                            const isSelected = colors.accent.toUpperCase() === hex.toUpperCase();
                            return (
                                <TouchableOpacity
                                    key={hex}
                                    style={[
                                        styles.colorSwatch,
                                        { backgroundColor: hex },
                                        isSelected && styles.colorSwatchSelected,
                                    ]}
                                    onPress={async () => {
                                        await setAccentColor(hex);
                                        setThemePickerVisible(false);
                                    }}
                                    activeOpacity={0.8}
                                />
                            );
                        })}
                    </View>
                    <TouchableOpacity
                        style={styles.themeModalClose}
                        onPress={() => setThemePickerVisible(false)}
                    >
                        <Text style={styles.themeModalCloseText}>Kapat</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
        <Modal
            visible={rememberInfoVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setRememberInfoVisible(false)}
        >
            <View style={styles.themeModalOverlay}>
                <View style={styles.themeModalCard}>
                    <View style={styles.modalAccentBar} />
                    <Text style={styles.themeModalTitle}>Tekrarlarımı Hatırla</Text>
                    <Text style={styles.themeModalDesc}>
                        Kapalıyken programdaki hedef tekrar görünür. Açıkken aynı hareket için son logladığın tekrar sayısı öncelik kazanır.
                    </Text>
                    <View style={styles.rememberCompareRow}>
                        <View style={styles.rememberExampleCard}>
                            <Text style={styles.rememberExampleTitle}>Kapalı</Text>
                            <Text style={styles.rememberInputLabel}>Tekrar</Text>
                            <View style={styles.rememberFakeInput}>
                                <Text style={styles.rememberFakePlaceholder}>8-12</Text>
                            </View>
                            <Text style={styles.rememberExampleText}>Program hedefi</Text>
                        </View>
                        <View style={styles.rememberExampleCard}>
                            <Text style={styles.rememberExampleTitle}>Açık</Text>
                            <Text style={styles.rememberInputLabel}>Tekrar</Text>
                            <View style={styles.rememberFakeInput}>
                                <Text style={styles.rememberFakePlaceholder}>10</Text>
                            </View>
                            <Text style={styles.rememberExampleText}>Son logun</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.themeModalClose}
                        onPress={() => setRememberInfoVisible(false)}
                    >
                        <Text style={styles.themeModalCloseText}>Anladım</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
        <Modal
            visible={reminderModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setReminderModalVisible(false)}
        >
            <View style={styles.themeModalOverlay}>
                <View style={styles.themeModalCard}>
                    <View style={styles.modalAccentBar} />
                    <Text style={styles.themeModalTitle}>Antrenman Oncesi Not</Text>
                    <Text style={styles.themeModalDesc}>
                        Session basladiginda kendine gostermek istedigin kisa hatirlatmayi yaz.
                    </Text>
                    <TextInput
                        style={styles.reminderInput}
                        value={reminderDraft}
                        onChangeText={setReminderDraft}
                        placeholder="Orn. Diz isindirma, formu bozma, RIR'i dürüst gir"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={220}
                        selectionColor={colors.accent}
                    />
                    <View style={styles.reminderModalActions}>
                        <TouchableOpacity
                            style={styles.themeModalClose}
                            onPress={() => setReminderModalVisible(false)}
                        >
                            <Text style={styles.themeModalCloseText}>Vazgec</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.reminderSaveBtn}
                            onPress={() => {
                                const next = reminderDraft.trim();
                                setPreWorkoutReminderNote(next);
                                setReminderModalVisible(false);
                                persistSettings({ pre_workout_reminder_note: next }, "pre-workout reminder note");
                            }}
                        >
                            <Text style={styles.reminderSaveText}>Kaydet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
        <NoticeModal
            visible={!!notice}
            title={notice?.title || ""}
            message={notice?.message || ""}
            onClose={() => setNotice(null)}
        />
        <ActionConfirmModal
            visible={deleteAccountPending}
            title="Hesabı sil?"
            message="Bu işlem hesabını, antrenmanlarını, programlarını ve ilişkili verilerini kalıcı olarak siler. Geri alınamaz."
            primaryLabel="Evet, sil"
            secondaryLabel="Vazgeç"
            onPrimary={handleDeleteAccount}
            onSecondary={() => setDeleteAccountPending(false)}
            onDismiss={() => setDeleteAccountPending(false)}
            destructivePrimary
        />
        <ActionConfirmModal
            visible={photoSourceVisible}
            title="Profil fotografi"
            message="Fotografi kamera ile cekebilir veya galeriden secebilirsin."
            primaryLabel="Kamera"
            secondaryLabel="Galeri"
            onPrimary={() => {
                setPhotoSourceVisible(false);
                pickProfileImageFromSource("camera");
            }}
            onSecondary={() => {
                setPhotoSourceVisible(false);
                pickProfileImageFromSource("gallery");
            }}
            onDismiss={() => setPhotoSourceVisible(false)}
        />
        </>
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
            <Text style={heatmapStyles.title}>Aktivite Takvimi</Text>
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
// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    profileHeader: {
        alignItems: "center",
        marginBottom: spacing.xxl,
    },
    avatarPressable: {
        marginBottom: spacing.md,
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
        backgroundColor: colors.accentMuted,
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
    settingBlock: {
        paddingVertical: spacing.sm,
    },
    settingInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: spacing.md,
    },
    settingActionCluster: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
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
    settingTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
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
    levelSegmentRow: {
        flexDirection: "row",
        gap: spacing.xs,
        marginTop: spacing.md,
    },
    levelSegment: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    levelSegmentActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    levelSegmentText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    levelSegmentTextActive: {
        color: colors.accent,
    },
    smallOutlineBtn: {
        minHeight: 34,
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    smallOutlineBtnText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    currentColorDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
    },
    themeModeToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        padding: 3,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    themeModeOption: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    themeModeOptionActive: {
        backgroundColor: colors.accent,
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
    themeModalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.62)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    themeModalCard: {
        width: "100%",
        maxWidth: 380,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.45,
        shadowRadius: 28,
        elevation: 20,
    },
    modalAccentBar: {
        height: 3,
        width: 72,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accent,
        marginBottom: spacing.md,
    },
    themeModalTitle: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        marginBottom: spacing.xs,
    },
    themeModalDesc: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        marginBottom: spacing.lg,
    },
    colorPickerGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.md,
        marginBottom: spacing.lg,
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
    colorSwatchSelected: {
        borderWidth: 3,
        borderColor: colors.text,
        transform: [{ scale: 1.15 }],
    },
    themeModalClose: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
    },
    themeModalCloseText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    reminderInput: {
        minHeight: 104,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceElevated,
        color: colors.text,
        fontSize: fontSize.sm,
        lineHeight: 20,
        padding: spacing.md,
        textAlignVertical: "top",
        marginTop: spacing.md,
    },
    reminderModalActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    reminderSaveBtn: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 46,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
    },
    reminderSaveText: {
        color: colors.background,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    rememberCompareRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    rememberExampleCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceLight,
        padding: spacing.md,
    },
    rememberExampleTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.sm,
    },
    rememberInputLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        marginBottom: spacing.xs,
    },
    rememberFakeInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
    },
    rememberFakePlaceholder: {
        color: colors.accent,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    rememberExampleText: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
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
