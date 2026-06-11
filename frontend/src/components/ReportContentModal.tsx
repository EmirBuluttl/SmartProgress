import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import AnimatedPressable from "./AnimatedPressable";
import PremiumModalSurface from "./PremiumModalSurface";

type Reason = "inappropriate" | "spam" | "harassment" | "misleading" | "other";

const REASONS: { value: Reason; label: string }[] = [
    { value: "inappropriate", label: "Uygunsuz içerik" },
    { value: "spam", label: "Spam" },
    { value: "harassment", label: "Hakaret / taciz" },
    { value: "misleading", label: "Yanıltıcı bilgi" },
    { value: "other", label: "Diğer" },
];

interface ReportContentModalProps {
    visible: boolean;
    title: string;
    message: string;
    busy?: boolean;
    onSubmit: (reason: Reason, details?: string) => void;
    onDismiss: () => void;
}

export default function ReportContentModal({
    visible,
    title,
    message,
    busy = false,
    onSubmit,
    onDismiss,
}: ReportContentModalProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [reason, setReason] = React.useState<Reason>("inappropriate");
    const [details, setDetails] = React.useState("");

    React.useEffect(() => {
        if (!visible) {
            setReason("inappropriate");
            setDetails("");
        }
    }, [visible]);

    return (
        <PremiumModalSurface visible={visible} onDismiss={onDismiss} containerStyle={styles.container}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <View style={styles.reasonGrid}>
                {REASONS.map((item) => {
                    const selected = reason === item.value;
                    return (
                        <AnimatedPressable
                            key={item.value}
                            style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                            onPress={() => setReason(item.value)}
                            pressedScale={0.98}
                        >
                            <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{item.label}</Text>
                        </AnimatedPressable>
                    );
                })}
            </View>
            <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Eklemek istediğin detay varsa yaz"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                maxLength={1000}
            />
            <View style={styles.buttonRow}>
                <AnimatedPressable style={[styles.button, styles.secondaryButton]} onPress={onDismiss} pressedScale={0.97}>
                    <Text style={styles.secondaryText}>Vazgeç</Text>
                </AnimatedPressable>
                <AnimatedPressable
                    style={[styles.button, styles.primaryButton]}
                    onPress={() => onSubmit(reason, details.trim() || undefined)}
                    disabled={busy}
                    pressedScale={0.97}
                >
                    <Text style={styles.primaryText}>{busy ? "Gönderiliyor..." : "Şikayet Et"}</Text>
                </AnimatedPressable>
            </View>
        </PremiumModalSurface>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) =>
    StyleSheet.create({
        container: {
            width: "100%",
            maxWidth: 420,
            padding: spacing.xl,
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
        title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: "center", marginBottom: spacing.sm },
        message: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, textAlign: "center", marginBottom: spacing.lg },
        reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
        reasonChip: {
            borderRadius: borderRadius.full,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
        },
        reasonChipSelected: {
            borderColor: colors.accent,
            backgroundColor: colors.accentMuted,
        },
        reasonText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
        reasonTextSelected: { color: colors.accent },
        input: {
            minHeight: 86,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceElevated,
            color: colors.text,
            padding: spacing.md,
            textAlignVertical: "top",
            marginBottom: spacing.lg,
        },
        buttonRow: { flexDirection: "row", gap: spacing.md },
        button: {
            flex: 1,
            minHeight: 48,
            borderRadius: borderRadius.md,
            borderWidth: 1.5,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.sm,
        },
        secondaryButton: { borderColor: colors.borderLight, backgroundColor: colors.surfaceElevated },
        primaryButton: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
        secondaryText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
        primaryText: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    });
