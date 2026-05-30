// ─────────────────────────────────────────────
// ErrorState — Hata durumu gösterimi
// message, isteğe bağlı onRetry
// ─────────────────────────────────────────────
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius, lineHeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

interface ErrorStateProps {
    message?: string;
    onRetry?: () => void;
    style?: ViewStyle;
}

export default function ErrorState({
    message = "Bir şeyler ters gitti.",
    onRetry,
    style,
}: ErrorStateProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={[styles.container, style]}>
            <View style={styles.iconWrap}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
            </View>
            <Text style={styles.title}>Hata</Text>
            <Text style={styles.message}>{message}</Text>
            {onRetry ? (
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={onRetry}
                    activeOpacity={0.75}
                >
                    <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                    <Text style={styles.retryText}>Tekrar Dene</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.xxxl,
        paddingVertical: spacing.xxxl,
    },
    iconWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.errorSubtle,
        borderWidth: 1,
        borderColor: colors.errorBorder,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    message: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: lineHeight.sm,
        marginBottom: spacing.xl,
    },
    retryBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentFill,
    },
    retryText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.accent,
    },
});
