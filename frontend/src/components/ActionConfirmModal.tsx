import React from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

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
}: ActionConfirmModalProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <Pressable style={styles.overlay} onPress={onDismiss}>
                <Pressable style={styles.container} onPress={(event) => event.stopPropagation()}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={onSecondary}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.primaryButton,
                                destructivePrimary && styles.destructiveButton,
                            ]}
                            onPress={onPrimary}
                            activeOpacity={0.85}
                        >
                            <Text style={[
                                styles.primaryText,
                                destructivePrimary && styles.destructiveText,
                            ]}>
                                {primaryLabel}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            backgroundColor: "rgba(0, 0, 0, 0.72)",
        },
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
    });
