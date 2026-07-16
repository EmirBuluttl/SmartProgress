import React from "react";
import { ActivityIndicator, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borderRadius, fontSize, fontWeight, lineHeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { moderationApi, parseApiError } from "../services/api";
import NoticeModal from "../components/NoticeModal";
import ActionConfirmModal from "../components/ActionConfirmModal";

type BlockedUser = {
    id: string;
    firstName?: string;
    lastName?: string;
    nickname?: string | null;
    avatarUrl?: string | null;
    displayName?: string;
    blockedAt?: string;
};

function initialsFor(user: BlockedUser) {
    const label = user.displayName || user.nickname || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Kullanıcı";
    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "K";
}

export default function BlockedUsersScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });

    const [loading, setLoading] = React.useState(true);
    const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
    const [blockedUsers, setBlockedUsers] = React.useState<BlockedUser[]>([]);
    const [confirmUser, setConfirmUser] = React.useState<BlockedUser | null>(null);
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);

    const loadBlockedUsers = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await moderationApi.listBlockedUsers();
            setBlockedUsers(Array.isArray(res.data?.users) ? res.data.users : []);
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Liste yüklenemedi", message: apiError.message || "Engellenen kullanıcılar alınırken bir sorun oluştu." });
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadBlockedUsers();
    }, [loadBlockedUsers]);

    const unblock = async () => {
        if (!confirmUser || busyUserId) return;
        setBusyUserId(confirmUser.id);
        try {
            await moderationApi.unblockUser(confirmUser.id);
            setBlockedUsers((prev) => prev.filter((user) => user.id !== confirmUser.id));
            setConfirmUser(null);
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Engel kaldırılamadı", message: apiError.message || "Lütfen tekrar dene." });
        } finally {
            setBusyUserId(null);
        }
    };

    return (
        <Animated.View style={[styles.container, animStyle, { paddingTop: insets.top + spacing.md }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.78}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.title}>Engellenen Kullanıcılar</Text>
                    <Text style={styles.subtitle}>Engellediğin profilleri burada görebilir ve engeli kaldırabilirsin.</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator color={colors.accent} />
                    <Text style={styles.stateText}>Liste hazırlanıyor...</Text>
                </View>
            ) : blockedUsers.length === 0 ? (
                <View style={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                        <Ionicons name="shield-checkmark-outline" size={24} color={colors.accent} />
                    </View>
                    <Text style={styles.emptyTitle}>Engellenen kullanıcı yok</Text>
                    <Text style={styles.emptyText}>Topluluk ve profil ekranlarından engellediğin kullanıcılar burada görünür.</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                    {blockedUsers.map((user) => {
                        const displayName = user.displayName || user.nickname || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Kullanıcı";
                        const blockedDate = user.blockedAt ? new Date(user.blockedAt).toLocaleDateString("tr-TR") : null;
                        return (
                            <View key={user.id} style={styles.userCard}>
                                {user.avatarUrl ? (
                                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatarFallback}>
                                        <Text style={styles.avatarText}>{initialsFor(user)}</Text>
                                    </View>
                                )}
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
                                    <Text style={styles.userMeta}>{blockedDate ? `${blockedDate} tarihinde engellendi` : "Engel aktif"}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.unblockBtn}
                                    onPress={() => setConfirmUser(user)}
                                    disabled={busyUserId === user.id}
                                    activeOpacity={0.82}
                                >
                                    <Text style={styles.unblockText}>{busyUserId === user.id ? "..." : "Kaldır"}</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <ActionConfirmModal
                visible={!!confirmUser}
                title="Engeli kaldır?"
                message={confirmUser ? `${confirmUser.displayName || confirmUser.nickname || "Bu kullanıcı"} ile etkileşim tekrar görünür hale gelebilir.` : ""}
                primaryLabel={busyUserId ? "İşleniyor..." : "Engeli kaldır"}
                secondaryLabel="Vazgeç"
                destructivePrimary
                onPrimary={unblock}
                onSecondary={() => setConfirmUser(null)}
                onDismiss={() => setConfirmUser(null)}
            />
            <NoticeModal
                visible={!!notice}
                title={notice?.title || ""}
                message={notice?.message || ""}
                onClose={() => setNotice(null)}
            />
        </Animated.View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.lg,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    backBtn: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTextWrap: { flex: 1 },
    title: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.xs,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: lineHeight.md,
    },
    centerState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    stateText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
    },
    emptyCard: {
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        alignItems: "center",
    },
    emptyIcon: {
        width: 54,
        height: 54,
        borderRadius: borderRadius.lg,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.xs,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: lineHeight.md,
        textAlign: "center",
    },
    listContent: {
        paddingBottom: spacing.xxl,
        gap: spacing.md,
    },
    userCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
    },
    avatarFallback: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    avatarText: {
        color: colors.accent,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    userInfo: {
        flex: 1,
        minWidth: 0,
    },
    userName: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    userMeta: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        marginTop: 2,
    },
    unblockBtn: {
        minHeight: 38,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    unblockText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
});
