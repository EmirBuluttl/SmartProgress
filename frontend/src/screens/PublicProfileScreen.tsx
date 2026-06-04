import React from "react";
import {
    ActivityIndicator,
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
import { profileApi } from "../services/api";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import SectionHeader from "../components/SectionHeader";

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
    const [profile, setProfile] = React.useState<any | null>(null);
    const [loading, setLoading] = React.useState(true);

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

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} size="large" />
            </View>
        );
    }

    if (!profile) return null;

    return (
        <View style={styles.container}>
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
                                    onPress={() => navigation.navigate("ProgramDetail", { programId: program.id })}
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
        </View>
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
