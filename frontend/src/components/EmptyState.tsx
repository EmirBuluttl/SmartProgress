// ─────────────────────────────────────────────
// EmptyState — Boş veri durumu gösterimi
// icon, title, subtitle, isteğe bağlı action
// ─────────────────────────────────────────────
import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ViewStyle,
    Animated,
    Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, fontSize, fontWeight, borderRadius, lineHeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import AnimatedPressable from "./AnimatedPressable";

interface EmptyStateProps {
    icon?: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
    style?: ViewStyle;
}

export default function EmptyState({
    icon = "document-outline",
    title,
    subtitle,
    actionLabel,
    onAction,
    style,
}: EmptyStateProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const float = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(float, { toValue: -5, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(float, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [float]);

    return (
        <View style={[styles.container, style]}>
            <Animated.View style={[styles.iconWrap, { transform: [{ translateY: float }] }]}>
                <Ionicons name={icon} size={40} color={colors.textMuted} />
            </Animated.View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
            {actionLabel && onAction ? (
                <AnimatedPressable
                    style={styles.actionBtn}
                    onPress={onAction}
                    pressedScale={0.97}
                >
                    <Text style={styles.actionText}>{actionLabel}</Text>
                </AnimatedPressable>
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
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        textAlign: "center",
        lineHeight: lineHeight.sm,
        marginBottom: spacing.xl,
    },
    actionBtn: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentFill,
    },
    actionText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.accent,
    },
});
