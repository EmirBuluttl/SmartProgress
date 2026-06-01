import React from "react";
import {
    StyleSheet,
    Text,
    View,
} from "react-native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import AnimatedPressable from "./AnimatedPressable";
import PremiumModalSurface from "./PremiumModalSurface";

interface ActionConfirmModalProps {
    visible: boolean;
    title: string;
    message: string;
    primaryLabel: string;
    secondaryLabel: string;
    onPrimary: () => void;
    onSecondary: () => void;
    onDismiss: () => void;
    destructivePrimary?: boolean;
    tertiaryLabel?: string;
    onTertiary?: () => void;
    destructiveTertiary?: boolean;
}

export default function ActionConfirmModal({
    visible,
    title,
    message,
    primaryLabel,
    secondaryLabel,
    onPrimary,
    onSecondary,
    onDismiss,
    destructivePrimary = false,
    tertiaryLabel,
    onTertiary,
    destructiveTertiary = false,
}: ActionConfirmModalProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <PremiumModalSurface visible={visible} onDismiss={onDismiss} containerStyle={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonRow}>
                        <AnimatedPressable
                            style={[styles.button, styles.secondaryButton]}
                            onPress={onSecondary}
                            pressedScale={0.97}
                        >
                            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
                        </AnimatedPressable>

                        <AnimatedPressable
                            style={[
                                styles.button,
                                styles.primaryButton,
                                destructivePrimary && styles.destructiveButton,
                            ]}
                            onPress={onPrimary}
                            pressedScale={0.97}
                        >
                            <Text style={[
                                styles.primaryText,
                                destructivePrimary && styles.destructiveText,
                            ]}>
                                {primaryLabel}
                            </Text>
                        </AnimatedPressable>
                    </View>
                    {tertiaryLabel && onTertiary && (
                        <AnimatedPressable
                            style={[
                                styles.tertiaryButton,
                                destructiveTertiary && styles.tertiaryDestructiveButton,
                            ]}
                            onPress={onTertiary}
                            pressedScale={0.98}
                        >
                            <Text style={[
                                styles.tertiaryText,
                                destructiveTertiary && styles.destructiveText,
                            ]}>
                                {tertiaryLabel}
                            </Text>
                        </AnimatedPressable>
                    )}
        </PremiumModalSurface>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) =>
    StyleSheet.create({
        container: {
            width: "100%",
            maxWidth: 380,
            padding: spacing.xxl,
            borderRadius: borderRadius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 24,
            elevation: 20,
        },
        title: {
            color: colors.text,
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            textAlign: "center",
            marginBottom: spacing.md,
        },
        message: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
            lineHeight: 22,
            textAlign: "center",
            marginBottom: spacing.xxl,
        },
        buttonRow: {
            flexDirection: "row",
            gap: spacing.md,
        },
        tertiaryButton: {
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            marginTop: spacing.md,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: "transparent",
        },
        tertiaryDestructiveButton: {
            borderColor: colors.error,
        },
        button: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 48,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
        },
        secondaryButton: {
            borderColor: colors.borderLight,
            backgroundColor: colors.surfaceElevated,
        },
        primaryButton: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        destructiveButton: {
            borderColor: colors.error,
            backgroundColor: colors.surfaceElevated,
        },
        secondaryText: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            textAlign: "center",
        },
        primaryText: {
            color: colors.accent,
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            textAlign: "center",
        },
        destructiveText: {
            color: colors.error,
        },
        tertiaryText: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            textAlign: "center",
        },
    });
