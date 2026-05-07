// ─────────────────────────────────────────────
// PrivacyModal — Cross-platform 3-button modal
// Web'de Alert.alert 3 buton desteklemediği için
// her platformda çalışan custom modal bileşeni
// ─────────────────────────────────────────────
import React from "react";
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Pressable,
} from "react-native";
import {
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
} from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

interface PrivacyModalProps {
    visible: boolean;
    onSelectPrivate: () => void;
    onSelectPublic: () => void;
    onCancel: () => void;
}

export default function PrivacyModal({
    visible,
    onSelectPrivate,
    onSelectPublic,
    onCancel,
}: PrivacyModalProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable style={styles.overlay} onPress={onCancel}>
                <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.icon}>🔒</Text>
                        <Text style={styles.title}>Gizlilik Ayarı</Text>
                    </View>

                    <Text style={styles.message}>
                        Bu programı herkese açık mı yoksa özel mi kaydetmek istersiniz?
                    </Text>

                    {/* Buttons */}
                    <View style={styles.buttonGroup}>
                        <TouchableOpacity
                            style={[styles.button, styles.privateButton]}
                            onPress={onSelectPrivate}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.privateIcon}>🔐</Text>
                            <View style={styles.buttonTextGroup}>
                                <Text style={styles.privateButtonText}>Özel</Text>
                                <Text style={styles.buttonSubtext}>Sadece sen görebilirsin</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.publicButton]}
                            onPress={onSelectPublic}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.publicIcon}>🌍</Text>
                            <View style={styles.buttonTextGroup}>
                                <Text style={styles.publicButtonText}>Herkese Açık</Text>
                                <Text style={styles.buttonSubtext}>Herkes görebilir</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Cancel */}
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onCancel}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelText}>İptal</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.xl,
        },
        container: {
            width: "100%",
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.xl,
            padding: spacing.xxl,
            borderWidth: 1,
            borderColor: colors.border,
            // Shadow
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 20,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.md,
            gap: spacing.sm,
        },
        icon: {
            fontSize: 22,
        },
        title: {
            fontSize: fontSize.xl,
            fontWeight: fontWeight.bold,
            color: colors.text,
            textAlign: "center",
        },
        message: {
            fontSize: fontSize.md,
            color: colors.textSecondary,
            textAlign: "center",
            marginBottom: spacing.xxl,
            lineHeight: 22,
        },
        buttonGroup: {
            gap: spacing.md,
            marginBottom: spacing.lg,
        },
        button: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.lg,
            borderRadius: borderRadius.lg,
            borderWidth: 1.5,
            gap: spacing.md,
        },
        privateButton: {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.borderLight,
        },
        publicButton: {
            backgroundColor: colors.accentMuted,
            borderColor: colors.accent,
        },
        privateIcon: {
            fontSize: 24,
        },
        publicIcon: {
            fontSize: 24,
        },
        buttonTextGroup: {
            flex: 1,
        },
        privateButtonText: {
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.text,
        },
        publicButtonText: {
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.accent,
        },
        buttonSubtext: {
            fontSize: fontSize.xs,
            color: colors.textMuted,
            marginTop: 2,
        },
        cancelButton: {
            alignItems: "center",
            paddingVertical: spacing.md,
        },
        cancelText: {
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            color: colors.textSecondary,
        },
    });
