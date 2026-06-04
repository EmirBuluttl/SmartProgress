import React from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
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
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 95,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(sweep, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(modalLift, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
            ]).start(() => {
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 145,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    isInteraction: false,
                }).start(({ finished }) => {
                    if (finished) setVisible(false);
                });
            });
        });
    }, [modalLift, opacity, sweep]);

    if (!visible) return null;

    const detailTranslate = sweep.interpolate({
        inputRange: [0, 1],
        outputRange: [26, -10],
    });
    const modalTranslate = modalLift.interpolate({
        inputRange: [0, 1],
        outputRange: [22, -2],
    });
    const modalScale = modalLift.interpolate({
        inputRange: [0, 1],
        outputRange: [0.985, 1],
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
                                outputRange: [0, 0.14],
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
                                outputRange: [0, 0.14],
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
        right: -18,
        bottom: 0,
        width: 28,
        zIndex: 1000,
        borderTopLeftRadius: 18,
        borderBottomLeftRadius: 18,
    },
    modalSweep: {
        position: "absolute",
        left: 28,
        right: 28,
        bottom: -10,
        height: 24,
        zIndex: 1000,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
    },
});
