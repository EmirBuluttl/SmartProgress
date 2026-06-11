import React from "react";
import {
    ActivityIndicator,
    Animated,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { moderationApi, parseApiError, profileApi } from "../services/api";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";
import { navigateWithFeedback } from "../utils/navigationFeedback";
import { useScreenEnter } from "../hooks/useScreenEnter";
import ActionConfirmModal from "../components/ActionConfirmModal";
import NoticeModal from "../components/NoticeModal";
import ReportContentModal from "../components/ReportContentModal";

type Nav = NativeStackNavigationProp<RootStackParamList, "PublicProfile">;
type Route = RouteProp<RootStackParamList, "PublicProfile">;

function initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "SP";
}

export default function PublicProfileScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const [profile, setProfile] = React.useState<any | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [reportTarget, setReportTarget] = React.useState<"PROFILE" | "PROFILE_PHOTO" | null>(null);
    const [blockVisible, setBlockVisible] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState<{ title: string; message: string; goBackOnClose?: boolean } | null>(null);

    const loadProfile = React.useCallback(async () => {
        try {
            const res = await profileApi.getPublicProfile(route.params.userId);
            setProfile(res.data);
        } finally {
            setLoading(false);
        }
    }, [route.params.userId]);

    useFocusEffect(React.useCallback(() => {
        setLoading(true);
        loadProfile();
    }, [loadProfile]));

    const submitReport = async (
        reason: "inappropriate" | "spam" | "harassment" | "misleading" | "other",
        details?: string,
    ) => {
        if (!reportTarget || busy) return;
        setBusy(true);
        try {
            await moderationApi.report({
                targetType: reportTarget,
                targetUserId: route.params.userId,
                reason,
                details,
            });
            setReportTarget(null);
            setNotice({ title: "Şikayet alındı", message: "Raporu manuel inceleme kuyruğuna aldık. Teşekkür ederiz." });
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Şikayet gönderilemedi", message: apiError.message });
        } finally {
            setBusy(false);
        }
    };

    const blockUser = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await moderationApi.blockUser(route.params.userId);
            setBlockVisible(false);
            setNotice({
                title: "Kullanıcı engellendi",
                message: "Bu kullanıcının public profili ve programları artık sana gösterilmeyecek.",
                goBackOnClose: true,
            });
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Engellenemedi", message: apiError.message });
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <Animated.View style={[styles.centered, animStyle]}>
                <ActivityIndicator color={colors.accent} size="large" />
            </Animated.View>
        );
    }

    if (!profile) return null;

    return (
        <Animated.View style={[styles.container, animStyle]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profil</Text>
                <View style={{ width: 24 }} />
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.profileTop}>
                    <View style={styles.avatar}>
                        {profile.avatarUrl ? (
                            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>{initials(profile.displayName || "")}</Text>
                        )}
                    </View>
                    <Text style={styles.name}>{profile.displayName}</Text>
                    <View style={styles.visibilityBadge}>
                        <Ionicons name={profile.isPublic ? "globe-outline" : "lock-closed-outline"} size={14} color={colors.accent} />
                        <Text style={styles.visibilityText}>{profile.isPublic ? "Public profil" : "Private profil"}</Text>
                    </View>
                    <View style={styles.moderationRow}>
                        <TouchableOpacity style={styles.moderationBtn} onPress={() => setReportTarget("PROFILE")} activeOpacity={0.75}>
                            <Ionicons name="flag-outline" size={15} color={colors.textSecondary} />
                            <Text style={styles.moderationText}>Profili şikayet et</Text>
                        </TouchableOpacity>
                        {profile.avatarUrl ? (
                            <TouchableOpacity style={styles.moderationBtn} onPress={() => setReportTarget("PROFILE_PHOTO")} activeOpacity={0.75}>
                                <Ionicons name="image-outline" size={15} color={colors.textSecondary} />
                                <Text style={styles.moderationText}>Fotoğrafı şikayet et</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.moderationBtn} onPress={() => setBlockVisible(true)} activeOpacity={0.75}>
                            <Ionicons name="ban-outline" size={15} color={colors.error} />
                            <Text style={[styles.moderationText, { color: colors.error }]}>Engelle</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {profile.locked ? (
                    <GymCard style={styles.lockedCard}>
                        <Ionicons name="lock-closed-outline" size={34} color={colors.textMuted} />
                        <Text style={styles.lockedTitle}>Bu profil kilitli</Text>
                        <Text style={styles.lockedText}>Kullanıcı progress detaylarını ve programlarını gizli tutuyor.</Text>
                    </GymCard>
                ) : (
                    <>
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{profile.stats?.workoutCount ?? 0}</Text>
                                <Text style={styles.statLabel}>Antrenman</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{profile.stats?.totalProgramStars ?? 0}</Text>
                                <Text style={styles.statLabel}>Yıldız</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{profile.stats?.publicProgramCount ?? 0}</Text>
                                <Text style={styles.statLabel}>Program</Text>
                            </View>
                        </View>

                        <SectionHeader title="Public Programlar" />
                        {(profile.programs || []).length > 0 ? (
                            [...profile.programs].sort((a: any, b: any) => (b.starCount || 0) - (a.starCount || 0)).map((program: any) => (
                                <TouchableOpacity
                                    key={program.id}
                                    activeOpacity={0.8}
                                    onPress={() => navigateWithFeedback(() => navigation.navigate("ProgramDetail", { programId: program.id }))}
                                >
                                    <GymCard style={styles.programCard}>
                                        <Text style={styles.programName}>{program.name}</Text>
                                        {program.description ? (
                                            <Text style={styles.programDesc} numberOfLines={2}>{program.description}</Text>
                                        ) : null}
                                        <View style={styles.programMeta}>
                                            <Ionicons name="star" size={14} color={colors.accent} />
                                            <Text style={styles.programMetaText}>{program.starCount || 0}</Text>
                                        </View>
                                    </GymCard>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>Henüz public program yok.</Text>
                        )}
                    </>
                )}
            </ScrollView>
            <ActionConfirmModal
                visible={blockVisible}
                title="Kullanıcıyı engelle?"
                message="Bu kullanıcıya ait public profil ve programlar artık sana gösterilmeyecek."
                primaryLabel={busy ? "İşleniyor..." : "Engelle"}
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={blockUser}
                onSecondary={() => setBlockVisible(false)}
                onDismiss={() => setBlockVisible(false)}
            />
            <ReportContentModal
                visible={!!reportTarget}
                title={reportTarget === "PROFILE_PHOTO" ? "Profil fotoğrafını şikayet et" : "Profili şikayet et"}
                message="Bu rapor manuel olarak incelenir. Uygunsuz veya yanıltıcı içerikleri bize bildir."
                busy={busy}
                onSubmit={submitReport}
                onDismiss={() => setReportTarget(null)}
            />
            <NoticeModal
                visible={!!notice}
                title={notice?.title || ""}
                message={notice?.message || ""}
                onClose={() => {
                    const shouldGoBack = notice?.goBackOnClose;
                    setNotice(null);
                    if (shouldGoBack) navigation.goBack();
                }}
            />
        </Animated.View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    profileTop: { alignItems: "center", marginBottom: spacing.xxl },
    avatar: {
        width: 86,
        height: 86,
        borderRadius: 43,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        borderWidth: 2,
        borderColor: colors.accent,
        marginBottom: spacing.md,
    },
    avatarImage: { width: 86, height: 86, borderRadius: 43 },
    avatarText: { color: colors.accent, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy },
    name: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy },
    visibilityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        marginTop: spacing.sm,
    },
    visibilityText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    moderationRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.md },
    moderationBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    moderationText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    lockedCard: { alignItems: "center", gap: spacing.sm },
    lockedTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    lockedText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center" },
    statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xxl },
    statBox: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        alignItems: "center",
    },
    statValue: { color: colors.accent, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy },
    statLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    programCard: { marginBottom: spacing.sm },
    programName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    programDesc: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 3 },
    programMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm },
    programMetaText: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    emptyText: { color: colors.textMuted, fontSize: fontSize.sm, fontStyle: "italic" },
});
