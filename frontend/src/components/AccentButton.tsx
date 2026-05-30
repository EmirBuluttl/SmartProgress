// ─────────────────────────────────────────────
// AccentButton — Large Gym-Friendly Button
// Büyük touch target, neon yeşil accent
// Pressable + Animated spring scale feedback
// ─────────────────────────────────────────────
import React from "react";
import {
    Pressable,
    Text,
    StyleSheet,
    ViewStyle,
    ActivityIndicator,
    Animated,
} from "react-native";
import { borderRadius, spacing, fontSize, fontWeight } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

interface AccentButtonProps {
    title: string;
    onPress: () => void;
    style?: ViewStyle;
    variant?: "primary" | "outline" | "ghost";
    size?: "md" | "lg";
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
}

export default function AccentButton({
    title,
    onPress,
    style,
    variant = "primary",
    size = "lg",
    loading = false,
    disabled = false,
    icon,
}: AccentButtonProps) {
    const { colors } = useTheme();
    const isPrimary = variant === "primary";
    const isOutline = variant === "outline";
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    // Scale animation — spring tap feedback
    const scale = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.97,
            useNativeDriver: true,
            speed: 40,
            bounciness: 0,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 30,
            bounciness: 4,
        }).start();
    };

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.base,
                size === "lg" ? styles.sizeLg : styles.sizeMd,
                isPrimary && styles.primary,
                isOutline && styles.outline,
                variant === "ghost" && styles.ghost,
                (disabled || loading) && styles.disabled,
                style,
            ]}
        >
            <Animated.View style={[styles.inner, { transform: [{ scale }] }]}>
                {loading ? (
                    <ActivityIndicator
                        color={isPrimary ? colors.background : colors.accent}
                        size="small"
                    />
                ) : (
                    <>
                        {icon}
                        <Text
                            style={[
                                styles.text,
                                isPrimary && styles.textPrimary,
                                (isOutline || variant === "ghost") && styles.textAccent,
                                icon ? { marginLeft: spacing.sm } : undefined,
                            ]}
                        >
                            {title}
                        </Text>
                    </>
                )}
            </Animated.View>
        </Pressable>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    base: {
        borderRadius: borderRadius.md,
        overflow: "hidden",
    },
    inner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    sizeLg: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xxl,
        minHeight: 56,
    },
    sizeMd: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        minHeight: 44,
    },
    primary: {
        backgroundColor: colors.accent,
    },
    outline: {
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: colors.accent,
    },
    ghost: {
        backgroundColor: "transparent",
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
    },
    textPrimary: {
        color: colors.background,
    },
    textAccent: {
        color: colors.accent,
    },
});