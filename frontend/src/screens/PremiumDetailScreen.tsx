import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AccentButton from "../components/AccentButton";
import AnimatedPressable from "../components/AnimatedPressable";
import GymCard from "../components/GymCard";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { navigateWithFeedback } from "../utils/navigationFeedback";

export default function PremiumDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter();
    const navigateStatic = React.useCallback(
        (screen: keyof RootStackParamList) => navigateWithFeedback(() => navigation.navigate(screen as any)),
        [navigation],
    );

    return (
        <ScrollView
            style={[styles.container, animStyle]}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.82}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>SMARTPROGRESS PREMIUM</Text>
                    <Text style={styles.title}>Akilli koc motoru</Text>
                    <Text style={styles.subtitle}>
                        Programini, loglarini ve toparlanma sinyallerini okuyup siradaki en mantikli aksiyonu gosterir.
                    </Text>
                </View>
            </View>

            <GymCard elevated style={styles.heroCard}>
                <View style={styles.heroIcon}>
                    <MaterialCommunityIcons name="brain" size={28} color={colors.background} />
                </View>
                <Text style={styles.heroTitle}>Premium ne yapar?</Text>
                <Text style={styles.heroText}>
                    Premium, AI sohbetten once gelen asil sistemdir: program kurar, haftalik raporlar, progress/plato/dusus sinyallerini yakalar ve aksiyon adaylarini kullanici onayina birakir.
                </Text>
                <AccentButton
                    title="Akilli Program Wizard'i Ac"
                    onPress={() => navigateStatic("PremiumProgramWizard")}
                    style={styles.cta}
                />
            </GymCard>

            <View style={styles.featureGrid}>
                <FeatureCard
                    icon="map-outline"
                    title="Kisisel program wizard"
                    text="Seviye, frekans, hedef, ekipman, agri ve kas onceligine gore split ve hareket secimi."
                    colors={colors}
                />
                <FeatureCard
                    icon="analytics-outline"
                    title="Haftalik rapor"
                    text="Yeterli log birikince haftanin progress, takip, plato ve regresyon sinyallerini ozetler."
                    colors={colors}
                />
                <FeatureCard
                    icon="trending-up-outline"
                    title="Progress takibi"
                    text="Kilo artisi, tekrar artisi ve RIR sinyallerini hareket bazli okuyarak sonraki hedefi netlestirir."
                    colors={colors}
                />
                <FeatureCard
                    icon="shield-checkmark-outline"
                    title="Karar sende"
                    text="Koc otomatik program degistirmez; hacim, RIR veya set onerilerini sen onaylamadan uygulamaz."
                    colors={colors}
                />
            </View>

            <GymCard style={styles.coachPlusCard}>
                <View style={styles.row}>
                    <View style={styles.smallIcon}>
                        <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Coach+ yakinda</Text>
                        <Text style={styles.cardText}>
                            AI soru-cevap katmani aktif paket degil. Kalite, maliyet ve guvenlik testleri tamamlanana kadar Premium'un ustunde pasif tanitilir.
                        </Text>
                    </View>
                </View>
            </GymCard>

            <AnimatedPressable style={styles.secondaryBtn} pressedScale={0.985} onPress={() => navigateStatic("CoachWeeklyReport")}>
                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                <Text style={styles.secondaryText}>Haftalik raporu gor</Text>
            </AnimatedPressable>
        </ScrollView>
    );
}

function FeatureCard({ icon, title, text, colors }: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    text: string;
    colors: any;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.featureCard}>
            <View style={styles.smallIcon}>
                <Ionicons name={icon} size={18} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardText}>{text}</Text>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.heavy, letterSpacing: 1 },
    title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy, marginTop: spacing.xs },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
    heroCard: { alignItems: "flex-start", gap: spacing.md },
    heroIcon: {
        width: 54,
        height: 54,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    heroTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    heroText: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
    cta: { width: "100%", marginTop: spacing.xs },
    featureGrid: { gap: spacing.md },
    featureCard: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    smallIcon: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    cardTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    cardText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    coachPlusCard: { borderStyle: "dashed" },
    row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    secondaryBtn: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    secondaryText: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
