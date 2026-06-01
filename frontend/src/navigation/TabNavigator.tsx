// ─────────────────────────────────────────────
// TabNavigator — Bottom Tab Navigation
// Custom dark gym-themed styling
// Tab focused → Animated.spring scale (1→1.18)
// Sliding transition between pages (swipeable horizontal paging)
// ─────────────────────────────────────────────
import React, { useRef, useState, useEffect } from "react";
import {
    StyleSheet,
    Platform,
    Animated,
    View,
    Text,
    ScrollView,
    useWindowDimensions,
    TouchableOpacity,
    Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

import HomeScreen from "../screens/HomeScreen";
import MyProgressScreen from "../screens/MyProgressScreen";
import CoachScreen from "../screens/CoachScreen";
import ProfileScreen from "../screens/ProfileScreen";

const tabScales: Record<string, Animated.Value> = {};

function getTabScale(routeName: string): Animated.Value {
    if (!tabScales[routeName]) {
        tabScales[routeName] = new Animated.Value(1);
    }
    return tabScales[routeName];
}

function AnimatedTabIcon({
    routeName,
    focused,
    color,
    size,
    iconFocused,
    iconUnfocused,
}: {
    routeName: string;
    focused: boolean;
    color: string;
    size: number;
    iconFocused: string;
    iconUnfocused: string;
}) {
    const scale = getTabScale(routeName);

    useEffect(() => {
        Animated.spring(scale, {
            toValue: focused ? 1.18 : 1,
            useNativeDriver: true,
            damping: 15,
            stiffness: 200,
            mass: 1,
        }).start();
    }, [focused, scale]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons
                name={(focused ? iconFocused : iconUnfocused) as any}
                size={size}
                color={color}
            />
        </Animated.View>
    );
}

export default function TabNavigator({ route }: any) {
    const { colors } = useTheme();
    const { width: screenWidth } = useWindowDimensions();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const isScrollingRef = useRef(false);

    const tabs = [
        {
            key: "Home",
            label: "Ana Sayfa",
            iconFocused: "home",
            iconUnfocused: "home-outline",
            component: HomeScreen,
        },
        {
            key: "MyProgress",
            label: "MyProgress",
            iconFocused: "analytics",
            iconUnfocused: "analytics-outline",
            component: MyProgressScreen,
        },
        {
            key: "Coach",
            label: "Koç",
            iconFocused: "chatbubble-ellipses",
            iconUnfocused: "chatbubble-ellipses-outline",
            component: CoachScreen,
        },
        {
            key: "Profile",
            label: "Profilim",
            iconFocused: "person",
            iconUnfocused: "person-outline",
            component: ProfileScreen,
        },
    ];

    // Handle deep navigation or tab switches from external screens
    const screenParam = route?.params?.screen;
    const lastHandledScreen = useRef<string | null>(null);

    useEffect(() => {
        if (screenParam && screenParam !== lastHandledScreen.current) {
            lastHandledScreen.current = screenParam;
            const targetIdx = tabs.findIndex((tab) => tab.key === screenParam);
            if (targetIdx !== -1) {
                handleTabPress(targetIdx);
            }
        }
    }, [screenParam]);

    // Keep screen offset aligned on window resizing (responsiveness)
    useEffect(() => {
        scrollViewRef.current?.scrollTo({
            x: activeIndex * screenWidth,
            animated: false,
        });
    }, [screenWidth]);

    // Listen to keyboard visibility to hide tab bar
    useEffect(() => {
        if (Platform.OS === "web") return;
        const showSubscription = Keyboard.addListener("keyboardDidShow", () =>
            setKeyboardVisible(true)
        );
        const hideSubscription = Keyboard.addListener("keyboardDidHide", () =>
            setKeyboardVisible(false)
        );
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const handleTabPress = (index: number) => {
        isScrollingRef.current = true;
        setActiveIndex(index);
        scrollViewRef.current?.scrollTo({
            x: index * screenWidth,
            animated: true,
        });
        setTimeout(() => {
            isScrollingRef.current = false;
        }, 350);
    };

    const handleScroll = (event: any) => {
        if (isScrollingRef.current) return;
        const xOffset = event.nativeEvent.contentOffset.x;
        const index = Math.round(xOffset / screenWidth);
        if (index !== activeIndex && index >= 0 && index < tabs.length) {
            setActiveIndex(index);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.scrollView}
                contentContainerStyle={{ width: screenWidth * tabs.length }}
                bounces={false}
            >
                {tabs.map((tab) => {
                    const ScreenComponent = tab.component;
                    return (
                        <View key={tab.key} style={{ width: screenWidth, flex: 1 }}>
                            <ScreenComponent />
                        </View>
                    );
                })}
            </ScrollView>

            {/* Custom Bottom Tab Bar */}
            <View style={[styles.tabBar, keyboardVisible && { display: "none" }]}>
                {tabs.map((tab, idx) => {
                    const focused = activeIndex === idx;
                    const color = focused ? colors.accent : colors.tabBarInactive;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={styles.tabBarItem}
                            onPress={() => handleTabPress(idx)}
                            activeOpacity={0.8}
                        >
                            <AnimatedTabIcon
                                routeName={tab.key}
                                focused={focused}
                                color={color}
                                size={22}
                                iconFocused={tab.iconFocused}
                                iconUnfocused={tab.iconUnfocused}
                            />
                            <Text style={[styles.tabBarLabel, { color }]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollView: {
            flex: 1,
        },
        tabBar: {
            flexDirection: "row",
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: Platform.OS === "ios" ? 88 : Platform.OS === "web" ? 72 : 68,
            paddingTop: 8,
            paddingBottom: Platform.OS === "ios" ? 28 : Platform.OS === "web" ? 12 : 10,
            elevation: 0,
            shadowOpacity: 0,
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
        },
        tabBarItem: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 2,
            paddingBottom: 4,
        },
        tabBarLabel: {
            fontSize: fontSize.xs,
            fontWeight: fontWeight.semibold,
            lineHeight: 16,
            marginTop: 4,
            marginBottom: 0,
        },
    });