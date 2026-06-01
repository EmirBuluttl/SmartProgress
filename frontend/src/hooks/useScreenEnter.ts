// ─────────────────────────────────────────────
// useScreenEnter — Ekran mount/focus animasyonu
// opacity: 0→1 (280ms) + translateY: 16→0 (spring)
// useFocusEffect ile her tab geçişinde tekrar çalışır
// useNativeDriver: true
// ─────────────────────────────────────────────
import { useRef, useCallback } from "react";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

interface ScreenEnterOptions {
    /** ms cinsinden gecikme — stagger için */
    delay?: number;
}

export function useScreenEnter({ delay = 0 }: ScreenEnterOptions = {}) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;

    useFocusEffect(
        useCallback(() => {
            opacity.setValue(0);
            translateY.setValue(16);

            const anim = Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 280,
                    delay,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    delay,
                    damping: 18,
                    stiffness: 90,
                    mass: 1,
                    useNativeDriver: true,
                }),
            ]);

            anim.start();
            return () => anim.stop();
        }, [delay, opacity, translateY])
    );

    return {
        animStyle: {
            opacity,
            transform: [{ translateY }],
        },
    };
}
