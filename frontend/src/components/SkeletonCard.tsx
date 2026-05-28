import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle } from "react-native";
import { useTheme } from "../hooks/ThemeContext";
import { borderRadius as br_ } from "../constants/theme";

interface SkeletonCardProps {
    width?: number | string;   // ✅ düzeltildi
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export default function SkeletonCard({
    width = "100%",
    height = 80,
    borderRadius = br_.md,
    style,
}: SkeletonCardProps) {
    const { colors } = useTheme();
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const anim = Animated.loop(
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
        );
        anim.start();
        return () => anim.stop();
    }, []);

    const opacity = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.2, 0.5],
    });

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: colors.surface,
                },
                { opacity },
                style,
            ]}
        />
    );
}

export function SkeletonRow({ style }: { style?: ViewStyle }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <SkeletonCard width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, gap: 8 }}>
                <SkeletonCard width="65%" height={13} borderRadius={6} />
                <SkeletonCard width="45%" height={11} borderRadius={6} />
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