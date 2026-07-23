import React from "react";
import {
    ActivityIndicator,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { parseApiError, programApi } from "../services/api";
import type { AuthStackParamList } from "../navigation/AuthStack";

type Route = RouteProp<AuthStackParamList, "ProgramDetail">;
type Nav = NativeStackNavigationProp<AuthStackParamList>;

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.smartprogress.app";
const APP_STORE_URL = "https://apps.apple.com/app/id6780054560";

function ownerName(program: any) {
    const user = program?.user;
    return user?.nickname || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "SmartProgress";
}

export default function PublicProgramPreviewScreen() {
    const route = useRoute<Route>();
    const navigation = useNavigation<Nav>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [program, setProgram] = React.useState<any | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [installPromptVisible, setInstallPromptVisible] = React.useState(false);
    const attemptedAutoOpenRef = React.useRef(false);

    React.useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await programApi.getPublicPreview(route.params.programId);
                if (mounted) setProgram(res.data);
            } catch (err) {
                const apiError = parseApiError(err);
                if (mounted) setError(apiError.message || "Program bulunamadi.");
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [route.params.programId]);

    const openStore = () => {
        const url = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
        Linking.openURL(url).catch(() => undefined);
    };

    const openApp = () => {
        Linking.openURL(`smartprogress://programs/${route.params.programId}`).catch(() => {
            if (Platform.OS === "web") {
                setInstallPromptVisible(true);
                return;
            }
            openStore();
        });
    };

    React.useEffect(() => {
        if (loading || error || !program || attemptedAutoOpenRef.current || Platform.OS !== "web") return;
        attemptedAutoOpenRef.current = true;
        const timer = setTimeout(() => setInstallPromptVisible(true), 1200);
        Linking.openURL(`smartprogress://programs/${route.params.programId}`).catch(() => {
            setInstallPromptVisible(true);
        });
        return () => clearTimeout(timer);
    }, [error, loading, program, route.params.programId]);

    const days = Array.isArray(program?.data?.days) ? program.data.days : [];
    const exerciseCount = Number(program?.data?.exerciseCount || 0);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.muted}>Program yukleniyor...</Text>
            </View>
        );
    }

    if (error || !program) {
        return (
            <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={34} color={colors.error} />
                <Text style={styles.title}>Program acilamadi</Text>
                <Text style={styles.muted}>{error || "Bu program private olabilir veya kaldirilmis olabilir."}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Login")}>
                    <Text style={styles.primaryText}>Giris yap</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.root} contentContainerStyle={styles.content}>
            <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                    <Ionicons name="barbell-outline" size={22} color={colors.accent} />
                </View>
                <View>
                    <Text style={styles.brand}>SmartProgress</Text>
                    <Text style={styles.muted}>Public program onizleme</Text>
                </View>
            </View>

            <View style={styles.hero}>
                <Text style={styles.eyebrow}>{ownerName(program)} paylasti</Text>
                <Text style={styles.title}>{program.name}</Text>
                {!!program.description && <Text style={styles.body}>{program.description}</Text>}

                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{program.frequency || days.length || "-"}</Text>
                        <Text style={styles.statLabel}>gun/hafta</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{days.length || "-"}</Text>
                        <Text style={styles.statLabel}>gun</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{exerciseCount || "-"}</Text>
                        <Text style={styles.statLabel}>hareket</Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statValue}>{program.starCount || 0}</Text>
                        <Text style={styles.statLabel}>yildiz</Text>
                    </View>
                </View>
            </View>

            <View style={styles.noticeCard}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
                <Text style={styles.noticeText}>
                    Gun detaylarini, hareketleri ve loglama akislarini uygulamada hesap olusturduktan sonra gorebilirsin.
                </Text>
            </View>

            <Modal
                visible={installPromptVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setInstallPromptVisible(false)}
            >
                <View style={styles.promptOverlay}>
                    <View style={styles.promptCard}>
                        <TouchableOpacity style={styles.promptClose} onPress={() => setInstallPromptVisible(false)} activeOpacity={0.8}>
                            <Ionicons name="close" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                        <View style={styles.promptIcon}>
                            <Ionicons name="phone-portrait-outline" size={22} color={colors.accent} />
                        </View>
                        <Text style={styles.promptTitle}>Programi uygulamada ac</Text>
                        <Text style={styles.promptText}>
                            SmartProgress yüklüyse program direkt uygulamada açılır. Yüklü değilse mağazadan kurup programı hesabına kaydedebilirsin.
                        </Text>
                        <TouchableOpacity style={styles.primaryBtn} onPress={openApp}>
                            <Text style={styles.primaryText}>Uygulamada ac</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={openStore}>
                            <Text style={styles.secondaryText}>Magazadan indir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.linkBtn} onPress={() => setInstallPromptVisible(false)}>
                            <Text style={styles.linkText}>Webde devam et</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {days.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Haftalik akis</Text>
                    {days.map((day: any, index: number) => (
                        <TouchableOpacity
                            key={`${day.label}-${index}`}
                            style={styles.dayRow}
                            activeOpacity={0.8}
                            onPress={() => navigation.navigate("Register")}
                        >
                            <View>
                                <Text style={styles.dayTitle}>{day.label || `${index + 1}. gun`}</Text>
                                <Text style={styles.dayMeta}>
                                    {day.isRestDay ? "Dinlenme gunu" : `${day.exerciseCount || 0} hareket`}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={styles.ctaCard}>
                <Text style={styles.ctaTitle}>Programi uygulamada kullan</Text>
                <Text style={styles.body}>
                    Kaydedip takip etmek, gunleri baslatmak ve loglamak icin SmartProgress hesabi ile devam et.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("Register")}>
                    <Text style={styles.primaryText}>Ucretsiz hesap olustur</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("Login")}>
                    <Text style={styles.secondaryText}>Zaten hesabim var</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkBtn} onPress={Platform.OS === "web" ? openStore : openApp}>
                    <Ionicons name="phone-portrait-outline" size={16} color={colors.accent} />
                    <Text style={styles.linkText}>Uygulamada ac</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

function createStyles(colors: any) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        content: { padding: spacing.lg, paddingBottom: spacing.xxl },
        center: {
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            gap: spacing.md,
        },
        brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
        brandIcon: {
            width: 44,
            height: 44,
            borderRadius: borderRadius.md,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
        },
        brand: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
        hero: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.sm,
        },
        eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: "uppercase" },
        title: { color: colors.text, fontSize: 28, fontWeight: fontWeight.bold, letterSpacing: 0 },
        body: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
        muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center" },
        statsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
        stat: {
            flexGrow: 1,
            minWidth: 110,
            backgroundColor: colors.background,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
        },
        statValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
        statLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
        noticeCard: {
            flexDirection: "row",
            gap: spacing.sm,
            backgroundColor: colors.accentMuted,
            borderColor: colors.accentBorder,
            borderWidth: 1,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginTop: spacing.md,
        },
        noticeText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 19 },
        section: { marginTop: spacing.lg, gap: spacing.sm },
        sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
        dayRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
        },
        dayTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
        dayMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
        ctaCard: {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.lg,
            gap: spacing.sm,
            marginTop: spacing.lg,
        },
        ctaTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
        primaryBtn: {
            height: 52,
            borderRadius: borderRadius.md,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.sm,
        },
        primaryText: { color: colors.background, fontSize: fontSize.md, fontWeight: fontWeight.bold },
        secondaryBtn: {
            height: 50,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
        },
        secondaryText: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
        linkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.sm },
        linkText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
        promptOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
        },
        promptCard: {
            width: "100%",
            maxWidth: 420,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing.lg,
            gap: spacing.sm,
        },
        promptClose: {
            position: "absolute",
            top: spacing.sm,
            right: spacing.sm,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
            zIndex: 2,
        },
        promptIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentMuted,
            borderWidth: 1,
            borderColor: colors.accentBorder,
        },
        promptTitle: {
            color: colors.text,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
        },
        promptText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            lineHeight: 20,
        },
    });
}
