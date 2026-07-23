import React from "react";
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ScrollViewProps,
    StyleProp,
    TouchableWithoutFeedback,
    ViewStyle,
} from "react-native";

type KeyboardSafeViewProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    keyboardVerticalOffset?: number;
    dismissOnPressOutside?: boolean;
};

type KeyboardAwareScrollViewProps = ScrollViewProps & {
    children: React.ReactNode;
    extraBottomPadding?: number;
};

export function KeyboardSafeView({
    children,
    style,
    keyboardVerticalOffset,
    dismissOnPressOutside = true,
}: KeyboardSafeViewProps) {
    const content = (
        <KeyboardAvoidingView
            style={style}
            behavior={Platform.OS === "web" ? undefined : "padding"}
            keyboardVerticalOffset={keyboardVerticalOffset ?? (Platform.OS === "ios" ? 12 : 0)}
        >
            {children}
        </KeyboardAvoidingView>
    );

    if (!dismissOnPressOutside || Platform.OS === "web") return content;

    return (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {content}
        </TouchableWithoutFeedback>
    );
}

export const KeyboardAwareScrollView = React.forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
    function KeyboardAwareScrollView(
        {
            children,
            contentContainerStyle,
            extraBottomPadding = 36,
            keyboardShouldPersistTaps = "handled",
            keyboardDismissMode,
            showsVerticalScrollIndicator = false,
            ...props
        },
        ref,
    ) {
        return (
            <ScrollView
                ref={ref}
                keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === "ios" ? "interactive" : "on-drag")}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                nestedScrollEnabled
                scrollEventThrottle={16}
                automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
                contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "automatic" : undefined}
                contentContainerStyle={[contentContainerStyle, { paddingBottom: extraBottomPadding }]}
                {...props}
            >
                {children}
            </ScrollView>
        );
    },
);
