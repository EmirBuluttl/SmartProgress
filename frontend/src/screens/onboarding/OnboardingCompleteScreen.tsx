import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderRadius, fontSize, fontWeight, spacing } from "../../constants/theme";
import { useTheme } from "../../hooks/ThemeContext";

type Props = {
    firstName?: string;
    onContinue: () => void;
};

export default function OnboardingCompleteScreen({ firstName = "Sporcu", onContinue }: Props) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="checkmark-circle-outline" size={34} color={colors.background} />
                </View>
                <Text style={styles.eyebrow}>ONBOARDING TAMAMLANDI</Text>
                <Text style={styles.title}>Profilin kaydedildi, {firstName}</Text>
                <Text style={styles.body}>
                    Cevaplarin program onerileri, koç rehberligi ve antrenman takibi icin hazir. Simdi uygulamayi ekranda tek tek taniyalim.
                </Text>
                <View style={styles.noteCard}>
                    <Ionicons name="map-outline" size={20} color={colors.accent} />
                    <Text style={styles.noteText}>
                        Tur bittiginde siradaki adim olarak ilk programini birlikte kurabilecegin ekrana gececeksin.
                    </Text>
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={onContinue} activeOpacity={0.84}>
                    <Text style={styles.primaryText}>Uygulamayi tani</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.background} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

function createStyles(colors: ReturnType<typeof import("../../hooks/ThemeContext").generateColors>) {
    return StyleSheet.create({
        root: {
            flex: 1,
            justifyContent: "center",
            backgroundColor: colors.background,
            padding: spacing.lg,
        },
        card: {
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        iconWrap: {
            width: 60,
            height: 60,
            borderRadius: borderRadius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accent,
        },
        eyebrow: {
            color: colors.accent,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            letterSpacing: 0,
        },
        title: {
            color: colors.text,
            fontSize: fontSize.xxl,
            fontWeight: fontWeight.bold,
            lineHeight: 32,
        },
        body: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
            lineHeight: 23,
        },
        noteCard: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
        },
        noteText: {
            flex: 1,
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            lineHeight: 20,
        },
        primaryBtn: {
            minHeight: 54,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        primaryText: {
            color: colors.background,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
        },
    });
}
