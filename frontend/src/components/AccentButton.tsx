import React from "react";
import {
    Text, StyleSheet, ViewStyle,
    ActivityIndicator, Pressable,
} from "react-native";
import Animated, {
    useSharedValue, withSpring, useAnimatedStyle,
} from "react-native-reanimated";
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

const SPRING_CONFIG = { damping: 15, stiffness: 400, mass: 1 };

export default function AccentButton({
    title, onPress, style,
    variant = "primary", size = "lg",
    loading = false, disabled = false, icon,
}: AccentButtonProps) {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const isPrimary = variant === "primary";
    const isOutline = variant === "outline";
    const isDisabled = disabled || loading;

    return (
        <Pressable
            onPressIn={() => {
                if (!isDisabled) scale.value = withSpring(0.96, SPRING_CONFIG);
            }}
            onPressOut={() => {
                scale.value = withSpring(1, SPRING_CONFIG);
            }}
            onPress={onPress}
            disabled={isDisabled}
        >
            <Animated.View
                style={[
                    styles.base,
                    size === "lg" ? styles.sizeLg : styles.sizeMd,
                    isPrimary && styles.primary,
                    isOutline && styles.outline,
                    variant === "ghost" && styles.ghost,
                    isDisabled && styles.disabled,
                    style,
                    animStyle,
                ]}
            >
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
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.md,
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
    primary: { backgroundColor: colors.accent },
    outline: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.accent },
    ghost: { backgroundColor: "transparent" },
    disabled: { opacity: 0.5 },
    text: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    textPrimary: { color: colors.background },
    textAccent: { color: colors.accent },
});