import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { borderRadius, fontSize, fontWeight, lineHeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import AnimatedPressable from "./AnimatedPressable";

type AppErrorBoundaryState = {
    hasError: boolean;
    error?: Error;
};

function AppCrashFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="alert-circle-outline" size={34} color={colors.error} />
                </View>
                <Text style={styles.title}>Bir şeyler ters gitti</Text>
                <Text style={styles.message}>
                    Ekran beklenmeyen bir hata yüzünden durdu. Verilerin korunması için uygulamayı güvenli moda aldık.
                </Text>
                {message ? <Text style={styles.detail} numberOfLines={2}>{message}</Text> : null}
                <AnimatedPressable style={styles.action} onPress={onRetry} pressedScale={0.97}>
                    <Ionicons name="refresh-outline" size={18} color={colors.background} />
                    <Text style={styles.actionText}>Tekrar dene</Text>
                </AnimatedPressable>
            </View>
        </View>
    );
}

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
    state: AppErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("[AppErrorBoundary]", error, info.componentStack);
    }

    private reset = () => {
        this.setState({ hasError: false, error: undefined });
    };

    render() {
        if (this.state.hasError) {
            return <AppCrashFallback message={this.state.error?.message} onRetry={this.reset} />;
        }

        return this.props.children;
    }
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: spacing.xl,
        backgroundColor: colors.background,
    },
    card: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        alignItems: "center",
        gap: spacing.md,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: colors.errorBorder,
        backgroundColor: colors.errorSubtle,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        textAlign: "center",
    },
    message: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: lineHeight.sm,
        textAlign: "center",
    },
    detail: {
        alignSelf: "stretch",
        color: colors.textMuted,
        fontSize: fontSize.xs,
        lineHeight: 18,
        textAlign: "center",
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.background,
    },
    action: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        paddingHorizontal: spacing.xl,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    actionText: {
        color: colors.background,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
});
