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
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

import HomeScreen from "../screens/HomeScreen";
import MyProgressScreen from "../screens/MyProgressScreen";
import CoachScreen from "../screens/CoachScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { MainTabKey, subscribeMainTabSwitch } from "../utils/mainTabEvents";
import AppTourOverlay, { AppTourStep } from "../components/AppTourOverlay";
import { AppTourProvider, useAppTour } from "../contexts/AppTourContext";
import {
    hasCompletedAppTour,
    hasPendingPostOnboardingFlow,
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

const REAL_APP_TOUR_STEPS: (AppTourStep & { tabIndex: number })[] = [
    { tabIndex: 0, targetId: "home.streak", tabLabel: "Ana Sayfa", icon: "flame-outline", title: "Antrenman serin", body: "Sol ustteki seri sayaci kac gundur antrenman kacirmadigini gosterir. Streak arttiginda uygulama bunu ayrica kutlar." },
    { tabIndex: 0, targetId: "home.headerActions", tabLabel: "Ana Sayfa", icon: "notifications-outline", title: "Bildirim ve profil", body: "Sag ustten bildirimlerini acabilir, yanindaki profil kisa yoluyla profil ve ayarlarina gecis yapabilirsin." },
    { tabIndex: 0, targetId: "home.quickWorkout", tabLabel: "Ana Sayfa", icon: "flash-outline", title: "Serbest antrenman", body: "Program secmeden hizlica bos log ekrani acip istedigin hareketleri ekleyerek antrenman kaydedebilirsin." },
    { tabIndex: 0, targetId: "home.stats", tabLabel: "Ana Sayfa", icon: "barbell-outline", title: "Antrenman ve progress ozeti", body: "Bu sayaclar toplam antrenmanini, seri durumunu ve yakalanan progress sinyallerini hizli okumani saglar." },
    { tabIndex: 0, targetId: "home.activeProgram", tabLabel: "Ana Sayfa", icon: "calendar-outline", title: "Aktif program takibi", body: "Takip ettigin programin ozeti ve aktif gunu burada durur. Siradaki antrenmana buradan devam edebilirsin." },
    { tabIndex: 0, targetId: "home.recentWorkouts", tabLabel: "Ana Sayfa", icon: "time-outline", title: "Son antrenmanlar", body: "Logladigin son antrenman kayitlari burada tutulur. Tum gecmise gecmek icin basligi kullanabilirsin." },
    { tabIndex: 0, targetId: "home.programs", tabLabel: "Ana Sayfa", icon: "reader-outline", title: "Program kutuphanen", body: "Kendi olusturdugun, kesfetten kaydettigin veya koc ile kurdugun programlar burada kutuphane gibi toplanir." },
    { tabIndex: 0, targetId: "home.community", tabLabel: "Ana Sayfa", icon: "people-outline", title: "Topluluk programlari", body: "Public program paylasabilir, populer programlari bulabilir veya aradigin spesifik programi kaydedip kullanabilirsin." },
    { tabIndex: 1, targetId: "progress.chart", tabLabel: "MyProgress", icon: "analytics-outline", title: "Progress grafigi", body: "Gelisimin grafik ve yuzdeliklerle burada okunur. Hangi metrikte ne kadar yol aldigini bu ekrandan takip edersin." },
    { tabIndex: 1, targetId: "progress.filter", tabLabel: "MyProgress", icon: "options-outline", title: "Filtrele", body: "Gormek istedigin gelisimi filtreleyebilir; performans, kas grubu, vucut veya beslenme metrikleri arasinda gezebilirsin." },
    { tabIndex: 1, targetId: "progress.records", tabLabel: "MyProgress", icon: "trophy-outline", title: "En iyi setlerim", body: "Hareketlerdeki en iyi performanslarin burada saklanir. Istersen YouTube veya Instagram video baglantisi da ekleyebilirsin." },
    { tabIndex: 2, targetId: "coach.hero", tabLabel: "Koc", icon: "sparkles-outline", title: "Premium koc merkezi", body: "Program takibini bilmeyen veya profesyonel yonlendirme isteyen kullanicilar icin ilerlemeyi koc mantigiyla izleyen alandir." },
    { tabIndex: 2, targetId: "coach.package", tabLabel: "Koc", icon: "document-text-outline", title: "60 gun Premium deneme", body: "Yeni kullanicilara kredi karti alinmadan 60 gun Premium/free tier hakki verilir. Bu sayfada daha detayli Premium sunumunu da bulabilirsin." },
    { tabIndex: 3, targetId: "profile.header", tabLabel: "Profil", icon: "person-outline", title: "Profil bilgilerin", body: "Ust kisimdan profil bilgilerini gorebilir ve duzenleyebilirsin." },
    { tabIndex: 3, targetId: "profile.heatmap", tabLabel: "Profil", icon: "calendar-outline", title: "Aktivite takvimi", body: "Hangi gunlerde antrenman yaptigini ve antrenman yogunlugunu isi haritasi gibi buradan izlersin." },
    { tabIndex: 3, targetId: "profile.tracking", tabLabel: "Profil", icon: "body-outline", title: "Vucut ve beslenme notlari", body: "Vucut olculeri ve beslenme takibini bir not defteri gibi kullanabilirsin." },
    { tabIndex: 3, targetId: "profile.notifications", tabLabel: "Profil", icon: "notifications-outline", title: "Bildirim ve hatirlaticilar", body: "Bildirimleri acmak faydali olur. Antrenman gunune ozel not veya dikkat etmen gereken hatirlaticilari buraya yazabilirsin." },
    { tabIndex: 3, targetId: "profile.level", tabLabel: "Profil", icon: "speedometer-outline", title: "Kullanici seviyesi", body: "Seviyen zamanla degisirse buradan guncelleyebilirsin; program ve koc yorumlari bunu dikkate alir." },
    { tabIndex: 3, targetId: "profile.rpeRir", tabLabel: "Profil", icon: "information-circle-outline", title: "RPE ve RIR", body: "Bu iki veri premium/koc deneyimini guclendirir. Antrenmanda RPE/RIR'i dikkatli loglamak daha iyi takip saglar." },
    { tabIndex: 3, targetId: "profile.exerciseLibrary", tabLabel: "Profil", icon: "library-outline", title: "Egzersiz kutuphanesi", body: "Kas grubu, ekipman ve diger parametrelere gore egzersiz bulabilecegin alandir." },
    { tabIndex: 3, targetId: "profile.rememberReps", tabLabel: "Profil", icon: "repeat-outline", title: "Tekrarlarimi hatirla", body: "Hareketlerdeki tekrar hafizasini buradan yonetebilirsin." },
    { tabIndex: 3, targetId: "profile.visibility", tabLabel: "Profil", icon: "lock-closed-outline", title: "Profil gorunurlugu", body: "Profil varsayilan olarak kapali baslar. Public program paylastiginda profilin gizli kalsin istiyorsan kapali tut." },
    { tabIndex: 3, targetId: "profile.themeColor", tabLabel: "Profil", icon: "color-palette-outline", title: "Tema rengi", body: "Uygulamanin accent rengini buradan degistirebilirsin." },
    { tabIndex: 3, targetId: "profile.themeMode", tabLabel: "Profil", icon: "sunny-outline", title: "Tema modu", body: "Istersen uygulamayi light mode ile de kullanabilirsin." },
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

export default function TabNavigator(props: any) {
    return (
        <AppTourProvider>
            <TabNavigatorInner {...props} />
        </AppTourProvider>
    );
}

function TabNavigatorInner({ route }: any) {
    const { colors } = useTheme();
    const navigation = useNavigation<any>();
    const isFocused = useIsFocused();
    const { getTarget } = useAppTour();
    const { width: screenWidth } = useWindowDimensions();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [activeIndex, setActiveIndex] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [externalSwitchVisible, setExternalSwitchVisible] = useState(false);
    const [tourVisible, setTourVisible] = useState(false);
    const [tourStepIndex, setTourStepIndex] = useState(0);
    const [tourMode, setTourMode] = useState<"quick" | "detailed">("quick");
    const [tourTargetVersion, setTourTargetVersion] = useState(0);
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
                if (!mounted) return;
                if (completed) {
                    hasPendingPostOnboardingFlow()
                        .then((pending) => {
                            if (mounted && pending) {
                                setTimeout(() => navigation.navigate("PostTourNextStep"), 420);
                            }
                        })
                        .catch(() => undefined);
                    return;
                }
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
    }, [navigation]);

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
        const shouldContinueOnboarding = await hasPendingPostOnboardingFlow().catch(() => false);
        if (shouldContinueOnboarding) {
            navigation.navigate("PostTourNextStep");
        }
    };

    const handleTourNext = () => {
        const steps = REAL_APP_TOUR_STEPS;
        const nextIndex = tourStepIndex + 1;
        if (nextIndex >= steps.length) {
            completeTour();
            return;
        }
        setTourStepIndex(nextIndex);
        const nextStep = steps[nextIndex];
        switchToTab(nextStep.tabIndex, true, 460);
    };

    const handleTourPrevious = () => {
        const previousIndex = tourStepIndex - 1;
        if (previousIndex < 0) return;
        setTourStepIndex(previousIndex);
        const previousStep = REAL_APP_TOUR_STEPS[previousIndex];
        switchToTab(previousStep.tabIndex, true, 460);
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

    const currentTourSteps = REAL_APP_TOUR_STEPS;

    useEffect(() => {
        if (!tourVisible) return;
        const step = currentTourSteps[tourStepIndex];
        if (!step) return;
        switchToTab(step.tabIndex, true, 460);
        const refreshTimers = [520, 900].map((delay) =>
            setTimeout(() => setTourTargetVersion((value) => value + 1), delay),
        );
        return () => refreshTimers.forEach(clearTimeout);
    }, [tourVisible, tourStepIndex, screenWidth]);

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
                visible={tourVisible && isFocused && !keyboardVisible}
                step={currentTourSteps[tourStepIndex]}
                current={tourStepIndex}
                total={currentTourSteps.length}
                onNext={handleTourNext}
                onPrevious={handleTourPrevious}
                onSkip={completeTour}
                getTarget={getTarget}
                targetVersion={tourTargetVersion}
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
