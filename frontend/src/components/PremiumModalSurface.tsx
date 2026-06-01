import React from "react";
import {
    Animated,
    Modal,
    Pressable,
    StyleProp,
    StyleSheet,
    ViewStyle,
} from "react-native";
import { spacing } from "../constants/theme";

interface PremiumModalSurfaceProps {
    visible: boolean;
    onDismiss: () => void;
    children: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
}

export default function PremiumModalSurface({
    visible,
    onDismiss,
    children,
    containerStyle,
}: PremiumModalSurfaceProps) {
    const opacity = React.useRef(new Animated.Value(0)).current;
    const scale = React.useRef(new Animated.Value(0.96)).current;
    const translateY = React.useRef(new Animated.Value(14)).current;

    React.useEffect(() => {
        if (!visible) return;
        opacity.setValue(0);
        scale.setValue(0.96);
        translateY.setValue(14);
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                speed: 22,
                bounciness: 6,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                speed: 22,
                bounciness: 5,
            }),
        ]).start();
    }, [opacity, scale, translateY, visible]);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <Animated.View style={[styles.overlay, { opacity }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                <Animated.View
                    style={[
                        containerStyle,
                        {
                            transform: [{ scale }, { translateY }],
                        },
                    ]}
                >
                    {children}
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
    },
});

