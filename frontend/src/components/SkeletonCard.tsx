import React, { useEffect } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../hooks/ThemeContext";
import { borderRadius } from "../constants/theme";

interface SkeletonCardProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export default function SkeletonCard({
    width = "100%",
    height = 80,
    borderRadius: br = borderRadius.md,
    style,
}: SkeletonCardProps) {
    const { colors } = useTheme();
    const shimmer = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, {
                    toValue: 1,
                    duration: 900,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmer, {
                    toValue: 0,
                    duration: 900,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.25, 0.55],
    });

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius: br,
                    backgroundColor: colors.surface,
                    opacity,
                },
                style,
            ]}
        />
    );
}

// ── Hazır kompozisyonlar ──────────────────────
export function SkeletonRow() {
    return (
        <View style={sk.row}>
            <SkeletonCard width={44} height={44} borderRadius={22} />
            <View style={sk.col}>
                <SkeletonCard width="70%" height={14} borderRadius={6} />
                <SkeletonCard width="45%" height={12} borderRadius={6} style={{ marginTop: 8 }} />
            </View>
        </View>
    );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
    return (
        <View style={{ gap: 12 }}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonRow key={i} />
            ))}
        </View>
    );
}

const sk = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    col: { flex: 1, gap: 0 },
});