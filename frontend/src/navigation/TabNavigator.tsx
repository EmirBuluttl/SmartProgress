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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

import HomeScreen from "../screens/HomeScreen";
import MyProgressScreen from "../screens/MyProgressScreen";
import CoachScreen from "../screens/CoachScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { MainTabKey, subscribeMainTabSwitch } from "../utils/mainTabEvents";
import AppTourOverlay, { AppTourStep } from "../components/AppTourOverlay";
import {
    hasCompletedAppTour,
    markAppTourCompleted,
    markDetailedAppTourCompleted,
    subscribeAppTourRequest,
    subscribeDetailedAppTourRequest,
} from "../utils/appTourEvents";
import { logPerf, markPerf } from "../utils/perfLogger";

const tabScales: Record<string, Animated.Value> = {};
const APP_TOUR_STEPS: (AppTourStep & { tabIndex: number })[] = [
    {
        tabIndex: 0,
        tabLabel: "Ana Sayfa",
        icon: "home-outline",
        title: "Antrenmanına buradan başlarsın",
        body: "Sıradaki antrenman, serbest antrenman ve son kayıtların ana ekranda hızlıca görünür.",
    },
    {
        tabIndex: 0,
        tabLabel: "Programlarım",
        icon: "reader-outline",
        title: "Aktif programını takip et",
        body: "Program kartlarını kullanarak gün detaylarını açabilir, takip ettiğin programı değiştirebilirsin.",
    },
    {
        tabIndex: 1,
        tabLabel: "MyProgress",
        icon: "analytics-outline",
        title: "Gelişimini grafiklerle oku",
        body: "Progress yüzdeleri, en iyi setlerin, vücut ölçülerin ve kalori kayıtların burada toparlanır.",
    },
    {
        tabIndex: 2,
        tabLabel: "Koç",
        icon: "bulb-outline",
        title: "Koç sinyallerini takip et",
        body: "Premium wizard, haftalık rapor ve plato/progress sinyalleri bu merkezde toplanır.",
    },
    {
        tabIndex: 3,
        tabLabel: "Profil",
        icon: "person-outline",
        title: "Profil ve ayarlarını yönet",
        body: "Seviye, tema, ölçü, kalori ve kişisel ayarlarını buradan düzenleyebilirsin.",
    },
];

const DETAILED_APP_TOUR_STEPS: (AppTourStep & { tabIndex: number })[] = [
    {
        tabIndex: 0,
        tabLabel: "Program oluşturma",
        icon: "reader-outline",
        title: "Programını kurarken kararlar net",
        body: "Frekans, split, süre, ekipman, ağrı/sakatlık ve öncelik seçimleri programın günlerini ve hareket önerilerini etkiler.",
    },
    {
        tabIndex: 0,
        tabLabel: "Workout log",
        icon: "barbell-outline",
        title: "Log ekranı verini korur",
        body: "Kg, tekrar, süre, RPE/RIR, sağ-sol ve superset akışlarını set set kaydedersin; yarıda çıkarsan aktif session geri yüklenir.",
    },
    {
        tabIndex: 1,
        tabLabel: "Progress filtreleri",
        icon: "analytics-outline",
        title: "Grafikleri filtreleyerek oku",
        body: "Performans, kas grubu, vücut ölçüsü ve beslenme metriklerini zaman aralığına göre değiştirip gelişimini takip edebilirsin.",
    },
    {
        tabIndex: 2,
        tabLabel: "Koç wizard",
        icon: "bulb-outline",
        title: "Koç motoru programı açıklar",
        body: "Wizard programı verdikten sonra amaç, haftalık akış, RPE/RIR, ağrı uyarıları ve ne zaman değişiklik yapmaman gerektiğini özetler.",
    },
    {
        tabIndex: 2,
        tabLabel: "Raporlar",
        icon: "document-text-outline",
        title: "Haftalık rapor ve sinyaller",
        body: "Yeterli log birikince progress, takip, plato ve müdahale adayları koç merkezinde görünür.",
    },
    {
        tabIndex: 3,
        tabLabel: "Bildirimler",
        icon: "notifications-outline",
        title: "Hatırlatıcılarını ayarlardan yönet",
        body: "Aktif program günlerine özel notlar, bildirim izni ve tekrar izlenebilir tur ayarları profil sekmesinde bulunur.",
    },
    {
        tabIndex: 3,
        tabLabel: "Premium / Trial",
        icon: "card-outline",
        title: "60 gün deneme ve Premium",
        body: "Yeni kullanıcılar 60 günlük denemeyle başlar; Premium ekranından satın alma ve restore akışlarını yönetebilirsin.",
    },
];

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
        Animated.timing(scale, {
            toValue: focused ? 1.04 : 1,
            duration: 240,
            useNativeDriver: true,
        }).start();
    }, [focused, scale]);

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            {routeName === "Coach" ? (
                <MaterialCommunityIcons
                    name="brain"
                    size={size}
                    color={color}
                />
            ) : (
                <Ionicons
                    name={(focused ? iconFocused : iconUnfocused) as any}
                    size={size}
                    color={color}
                />
            )}
        </Animated.View>
    );
}

export default function TabNavigator({ route }: any) {
    const { colors } = useTheme();
    const { width: screenWidth } = useWindowDimensions();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [externalSwitchVisible, setExternalSwitchVisible] = useState(false);
    const [tourVisible, setTourVisible] = useState(false);
    const [tourStepIndex, setTourStepIndex] = useState(0);
    const [tourMode, setTourMode] = useState<"quick" | "detailed">("quick");
    const [mountedTabs, setMountedTabs] = useState<Set<number>>(() => new Set([0]));
    const scrollViewRef = useRef<ScrollView | null>(null);
    const isScrollingRef = useRef(false);
    const activeIndexRef = useRef(0);
    const lockedIndexRef = useRef<number | null>(null);
    const lockUntilRef = useRef(0);
    const currentOffsetRef = useRef(0);
    const externalSwitchOpacity = useRef(new Animated.Value(0)).current;

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
            iconFocused: "brain",
            iconUnfocused: "brain",
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

    useEffect(() => {
        let mounted = true;
        hasCompletedAppTour()
            .then((completed) => {
                if (!mounted || completed) return;
                setTimeout(() => {
                    if (mounted) {
                        setTourMode("quick");
                        setTourVisible(true);
                    }
                }, 700);
            })
            .catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        return subscribeAppTourRequest(() => {
            setTourMode("quick");
            setTourStepIndex(0);
            switchToTab(0, true, 460);
            setTimeout(() => setTourVisible(true), 260);
        });
    }, [screenWidth]);

    useEffect(() => {
        return subscribeDetailedAppTourRequest(() => {
            setTourMode("detailed");
            setTourStepIndex(0);
            switchToTab(0, true, 460);
            setTimeout(() => setTourVisible(true), 260);
        });
    }, [screenWidth]);

    // Handle deep navigation or tab switches from external screens
    const screenParam = route?.params?.screen;
    const switchKey = route?.params?.switchKey;
    const lastHandledScreen = useRef<string | null>(null);

    useEffect(() => {
        const navigationKey = screenParam ? `${screenParam}:${switchKey ?? ""}` : null;
        if (screenParam && navigationKey !== lastHandledScreen.current) {
            lastHandledScreen.current = navigationKey;
            const targetIdx = tabs.findIndex((tab) => tab.key === screenParam);
            if (targetIdx !== -1) {
                switchToTab(targetIdx, false);
            }
        }
    }, [screenParam, switchKey]);

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

    const switchToTab = (index: number, animated = true, lockMs = animated ? 460 : 180) => {
        if (!mountedTabs.has(index)) {
            markPerf(`tab_lazy_mount_${tabs[index]?.key || index}`);
            setMountedTabs((current) => new Set(current).add(index));
            requestAnimationFrame(() => logPerf(`tab_lazy_mount_${tabs[index]?.key || index}`, `tab_lazy_mount_${tabs[index]?.key || index}`));
        }
        const targetOffset = index * screenWidth;
        isScrollingRef.current = true;
        lockedIndexRef.current = index;
        lockUntilRef.current = Date.now() + lockMs;
        activeIndexRef.current = index;
        setActiveIndex(index);
        scrollViewRef.current?.scrollTo({
            x: targetOffset,
            animated,
        });
        if (!animated) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({
                    x: targetOffset,
                    animated: false,
                });
            }, 40);
        }
        setTimeout(() => {
            if (Math.abs(currentOffsetRef.current - targetOffset) > 2) {
                scrollViewRef.current?.scrollTo({
                    x: targetOffset,
                    animated: false,
                });
            }
            lockedIndexRef.current = null;
            isScrollingRef.current = false;
        }, lockMs);
    };

    const handleTabPress = (index: number) => {
        if (index === activeIndexRef.current) return;
        switchToTab(index, true, 460);
    };

    const completeTour = async () => {
        setTourVisible(false);
        if (tourMode === "detailed") {
            await markDetailedAppTourCompleted();
            return;
        }
        await markAppTourCompleted();
    };

    const handleTourNext = () => {
        const steps = tourMode === "detailed" ? DETAILED_APP_TOUR_STEPS : APP_TOUR_STEPS;
        const nextIndex = tourStepIndex + 1;
        if (nextIndex >= steps.length) {
            completeTour();
            return;
        }
        setTourStepIndex(nextIndex);
        const nextStep = steps[nextIndex];
        switchToTab(nextStep.tabIndex, true, 460);
    };

    const showExternalSwitchCover = () => {
        setExternalSwitchVisible(true);
        externalSwitchOpacity.stopAnimation();
        externalSwitchOpacity.setValue(0.26);
        setTimeout(() => {
            Animated.timing(externalSwitchOpacity, {
                toValue: 0,
                duration: 320,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    setExternalSwitchVisible(false);
                }
            });
        }, 120);
    };

    useEffect(() => {
        return subscribeMainTabSwitch((tabKey: MainTabKey) => {
            const targetIdx = tabs.findIndex((tab) => tab.key === tabKey);
            if (targetIdx !== -1) {
                showExternalSwitchCover();
                switchToTab(targetIdx, false);
                setTimeout(() => switchToTab(targetIdx, false), 120);
            }
        });
    }, [screenWidth]);

    const handleScroll = (event: any) => {
        const xOffset = event.nativeEvent.contentOffset.x;
        currentOffsetRef.current = xOffset;
        if (isScrollingRef.current) return;
        const index = Math.round(xOffset / screenWidth);
        if (Date.now() < lockUntilRef.current && lockedIndexRef.current !== null && index !== lockedIndexRef.current) {
            scrollViewRef.current?.scrollTo({
                x: lockedIndexRef.current * screenWidth,
                animated: false,
            });
            return;
        }
        if (index !== activeIndexRef.current && index >= 0 && index < tabs.length) {
            if (!mountedTabs.has(index)) {
                markPerf(`tab_lazy_mount_${tabs[index]?.key || index}`);
                setMountedTabs((current) => new Set(current).add(index));
                requestAnimationFrame(() => logPerf(`tab_lazy_mount_${tabs[index]?.key || index}`, `tab_lazy_mount_${tabs[index]?.key || index}`));
            }
            activeIndexRef.current = index;
            setActiveIndex(index);
        }
    };

    const currentTourSteps = tourMode === "detailed" ? DETAILED_APP_TOUR_STEPS : APP_TOUR_STEPS;

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
                            {mountedTabs.has(tabs.findIndex((item) => item.key === tab.key)) ? <ScreenComponent /> : null}
                        </View>
                    );
                })}
            </ScrollView>

            {externalSwitchVisible ? (
                <Animated.View
                    pointerEvents="none"
                    style={[styles.externalSwitchCover, { opacity: externalSwitchOpacity }]}
                >
                    <View style={styles.externalSwitchAccent} />
                </Animated.View>
            ) : null}

            <AppTourOverlay
                visible={tourVisible}
                step={currentTourSteps[tourStepIndex]}
                current={tourStepIndex}
                total={currentTourSteps.length}
                onNext={handleTourNext}
                onSkip={completeTour}
            />

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
        externalSwitchCover: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
        },
        externalSwitchAccent: {
            width: 72,
            height: 3,
            borderRadius: 99,
            backgroundColor: colors.accent,
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
