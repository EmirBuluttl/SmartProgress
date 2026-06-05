import React from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import { useTheme } from "../hooks/ThemeContext";
import {
    NavigationFeedbackVariant,
    subscribeNavigationFeedback,
} from "../utils/navigationFeedback";

export default function NavigationFeedbackOverlay() {
    const { colors } = useTheme();
    const { width, height } = useWindowDimensions();
    const [visible, setVisible] = React.useState(false);
    const [variant, setVariant] = React.useState<NavigationFeedbackVariant>("detail");
    const progress = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        return subscribeNavigationFeedback((event) => {
            setVariant(event.variant);
            setVisible(true);
            progress.stopAnimation();
            progress.setValue(0);

            const enterDuration = event.variant === "modal" ? 120 : 220;
            const exitDuration = event.variant === "modal" ? 210 : 300;

            Animated.sequence([
                Animated.timing(progress, {
                    toValue: 1,
                    duration: enterDuration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(progress, {
                    toValue: 2,
                    duration: exitDuration,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
            ]).start(({ finished }) => {
                if (finished) setVisible(false);
            });
        });
    }, [progress]);

    if (!visible) return null;

    const detailTranslate = progress.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [width, 0, -width],
    });
    const modalTranslate = progress.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [height, 0, -height],
    });
    const panelOpacity = progress.interpolate({
        inputRange: [0, 0.08, 1.92, 2],
        outputRange: [0, 1, 1, 0],
    });

    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View
                style={[
                    styles.panel,
                    {
                        backgroundColor: colors.background,
                        opacity: panelOpacity,
                        transform: [
                            variant === "modal"
                                ? { translateY: modalTranslate }
                                : { translateX: detailTranslate },
                        ],
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
});
