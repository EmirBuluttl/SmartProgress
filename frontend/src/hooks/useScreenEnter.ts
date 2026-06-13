import { useEffect, useRef } from "react";
import { Animated, Easing, Platform } from "react-native";

interface ScreenEnterOptions {
    delay?: number;
    variant?: "fadeUp" | "slide";
}

export function useScreenEnter({ delay = 0, variant = "fadeUp" }: ScreenEnterOptions = {}) {
    const animationsDisabled = Platform.OS === "android";
    const opacity = useRef(new Animated.Value(0)).current;
    const translate = useRef(new Animated.Value(variant === "slide" ? 44 : 16)).current;

    useEffect(() => {
        if (animationsDisabled) {
            opacity.setValue(1);
            translate.setValue(0);
            return;
        }

        opacity.setValue(0);
        translate.setValue(variant === "slide" ? 44 : 16);

        const anim = Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 220,
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
    }, [animationsDisabled, delay, opacity, translate, variant]);

    return {
        animStyle: animationsDisabled
            ? { opacity: 1 }
            : {
                opacity,
                transform: [variant === "slide" ? { translateX: translate } : { translateY: translate }],
            },
    };
}
