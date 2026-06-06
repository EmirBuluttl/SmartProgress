import { useRef, useCallback } from "react";
import { Animated, Easing } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

interface ScreenEnterOptions {
    delay?: number;
    variant?: "fadeUp" | "slide";
}

export function useScreenEnter({ delay = 0, variant = "fadeUp" }: ScreenEnterOptions = {}) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translate = useRef(new Animated.Value(variant === "slide" ? 44 : 16)).current;

    useFocusEffect(
        useCallback(() => {
            opacity.setValue(0);
            translate.setValue(variant === "slide" ? 44 : 16);

            const anim = Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: variant === "slide" ? 220 : 220,
                    delay,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                variant === "slide"
                    ? Animated.timing(translate, {
                        toValue: 0,
                        duration: 240,
                        delay,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                    })
                    : Animated.spring(translate, {
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
        }, [delay, opacity, translate, variant]),
    );

    return {
        animStyle: {
            opacity,
            transform: [variant === "slide" ? { translateX: translate } : { translateY: translate }],
        },
    };
}
