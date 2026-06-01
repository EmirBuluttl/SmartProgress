import React from "react";
import {
    Animated,
    GestureResponderEvent,
    Pressable,
    PressableProps,
    StyleProp,
    ViewStyle,
} from "react-native";

type AnimatedPressableProps = PressableProps & {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    pressedScale?: number;
};

export default function AnimatedPressable({
    children,
    style,
    pressedScale = 0.98,
    onPressIn,
    onPressOut,
    disabled,
    ...props
}: AnimatedPressableProps) {
    const scale = React.useRef(new Animated.Value(1)).current;

    const animateTo = React.useCallback((value: number) => {
        Animated.spring(scale, {
            toValue: value,
            useNativeDriver: true,
            speed: 26,
            bounciness: 5,
        }).start();
    }, [scale]);

    const handlePressIn = (event: GestureResponderEvent) => {
        if (!disabled) animateTo(pressedScale);
        onPressIn?.(event);
    };

    const handlePressOut = (event: GestureResponderEvent) => {
        if (!disabled) animateTo(1);
        onPressOut?.(event);
    };

    return (
        <Pressable
            {...props}
            disabled={disabled}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={style}
        >
            <Animated.View style={{ transform: [{ scale }], opacity: disabled ? 0.55 : 1 }}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

