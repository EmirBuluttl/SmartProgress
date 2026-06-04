import React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "../hooks/ThemeContext";
import {
    NavigationFeedbackVariant,
    subscribeNavigationFeedback,
} from "../utils/navigationFeedback";

export default function NavigationFeedbackOverlay() {
    const { colors } = useTheme();
    const [visible, setVisible] = React.useState(false);
    const [variant, setVariant] = React.useState<NavigationFeedbackVariant>("detail");
    const opacity = React.useRef(new Animated.Value(0)).current;
    const sweep = React.useRef(new Animated.Value(0)).current;
    const modalLift = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        return subscribeNavigationFeedback((event) => {
            setVariant(event.variant);
            setVisible(true);
            opacity.stopAnimation();
            sweep.stopAnimation();
            modalLift.stopAnimation();
            opacity.setValue(0);
            sweep.setValue(0);
            modalLift.setValue(0);

            Animated.parallel([
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 110,
                        useNativeDriver: true,
                    }),
                    Animated.delay(135),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 260,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.timing(sweep, {
                    toValue: 1,
                    duration: 430,
                    useNativeDriver: true,
                }),
                Animated.timing(modalLift, {
                    toValue: 1,
                    duration: 390,
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) setVisible(false);
            });
        });
    }, [modalLift, opacity, sweep]);

    if (!visible) return null;

    const detailTranslate = sweep.interpolate({
        inputRange: [0, 1],
        outputRange: [92, -32],
    });
    const modalTranslate = modalLift.interpolate({
        inputRange: [0, 1],
        outputRange: [96, -8],
    });
    const modalScale = modalLift.interpolate({
        inputRange: [0, 1],
        outputRange: [0.98, 1.01],
    });

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    styles.scrim,
                    {
                        backgroundColor: colors.background,
                        opacity: opacity.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.1],
                        }),
                    },
                ]}
            />
            {variant === "modal" ? (
                <Animated.View
                    style={[
                        styles.modalSweep,
                        {
                            backgroundColor: colors.accent,
                            opacity: opacity.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 0.2],
                            }),
                            transform: [{ translateY: modalTranslate }, { scaleX: modalScale }],
                        },
                    ]}
                />
            ) : (
                <Animated.View
                    style={[
                        styles.detailSweep,
                        {
                            backgroundColor: colors.accent,
                            opacity: opacity.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 0.16],
                            }),
                            transform: [{ translateX: detailTranslate }],
                        },
                    ]}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    scrim: {
        zIndex: 999,
    },
    detailSweep: {
        position: "absolute",
        top: 0,
        right: -80,
        bottom: 0,
        width: 120,
        zIndex: 1000,
        borderTopLeftRadius: 48,
        borderBottomLeftRadius: 48,
    },
    modalSweep: {
        position: "absolute",
        left: 18,
        right: 18,
        bottom: -34,
        height: 86,
        zIndex: 1000,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
});
