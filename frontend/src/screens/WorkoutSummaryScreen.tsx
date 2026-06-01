// ─────────────────────────────────────────────
// WorkoutSummaryScreen — Post-workout özeti
// Antrenman bitince gösterilen özet ekranı
// ─────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import AccentButton from "../components/AccentButton";
import NoticeModal from "../components/NoticeModal";
import AnimatedPressable from "../components/AnimatedPressable";
import { CARDIO_TYPE_LABELS, summarizeCardioBlock, summarizeCardioBlocks } from "../utils/cardio";

type SummaryRoute = RouteProp<RootStackParamList, "WorkoutSummary">;

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}sa ${m}dk`;
    if (m > 0) return `${m}dk ${s > 0 ? `${s}sn` : ""}`.trim();
    return `${s}sn`;
}

export default function WorkoutSummaryScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<SummaryRoute>();
    const {
        programName,
        dayLabel,
        nextDayLabel,
        totalVolume,
        duration,
        exerciseCount,
        setCount,
        notes,
        cardioBlocks,
    } = route.params;

    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [notesVisible, setNotesVisible] = useState(false);
    const trimmedNotes = notes?.trim();

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const sparkleAnim = useRef(new Animated.Value(0)).current;
    const statAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        scaleAnim.setValue(0);
        fadeAnim.setValue(0);
        sparkleAnim.setValue(0);
        statAnims.forEach((anim) => anim.setValue(0));

        Animated.sequence([
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 80,
                    friction: 6,
                    useNativeDriver: true,
                }),
                Animated.timing(sparkleAnim, {
                    toValue: 1,
                    duration: 720,
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 360,
                    useNativeDriver: true,
                }),
                Animated.stagger(
                    70,
                    statAnims.map((anim) =>
                        Animated.spring(anim, {
                            toValue: 1,
                            tension: 70,
                            friction: 8,
                            useNativeDriver: true,
                        })
                    )
                ),
            ]),
        ]).start();
    }, [fadeAnim, scaleAnim, sparkleAnim, statAnims]);

    const handleGoHome = () => {
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
    };

    const sparkleDots = [
        { left: 0, top: 12, width: 6, height: 6, x: -18, y: -18 },
        { right: -4, top: 20, width: 5, height: 5, x: 20, y: -14 },
        { left: 18, bottom: 4, width: 4, height: 4, x: -14, y: 14 },
        { right: 18, bottom: 0, width: 6, height: 6, x: 16, y: 16 },
        { left: 46, top: -8, width: 4, height: 4, x: 0, y: -20 },
    ];

    const statItems = [
        { icon: "barbell-outline" as const, value: Number(totalVolume || 0).toFixed(1), label: "Yük Skoru" },
        { icon: "time-outline" as const, value: formatDuration(duration), label: "Süre" },
        { icon: "flash-outline" as const, value: exerciseCount, label: "Egzersiz" },
        { icon: "repeat-outline" as const, value: setCount, label: "Set" },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* ─── Trophy Animation ─── */}
            <Animated.View
                style={[styles.trophyWrap, { transform: [{ scale: scaleAnim }] }]}
            >
                <View pointerEvents="none" style={styles.sparkleLayer}>
                    {sparkleDots.map((dot, index) => (
                        <Animated.View
                            key={`${dot.width}-${index}`}
                            style={[
                                styles.sparkleDot,
                                dot,
                                {
                                    opacity: sparkleAnim.interpolate({
                                        inputRange: [0, 0.22, 1],
                                        outputRange: [0, 1, 0],
                                    }),
                                    transform: [
                                        {
                                            translateX: sparkleAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, dot.x],
                                            }),
                                        },
                                        {
                                            translateY: sparkleAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, dot.y],
                                            }),
                                        },
                                        {
                                            scale: sparkleAnim.interpolate({
                                                inputRange: [0, 0.35, 1],
                                                outputRange: [0.6, 1.15, 0.75],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        />
                    ))}
                </View>
                <View style={styles.trophyCircle}>
                    <Ionicons name="trophy-outline" size={48} color={colors.accent} />
                </View>
            </Animated.View>

            <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={styles.congratsTitle}>Harika İş Çıkardın!</Text>
                {dayLabel ? (
                    <Text style={styles.congratsSub}>
                        {programName ? `${programName} · ` : ""}{dayLabel} tamamlandı
                    </Text>
                ) : (
                    <Text style={styles.congratsSub}>Antrenman tamamlandı</Text>
                )}
            </Animated.View>

            {/* ─── Stats Grid ─── */}
            <View style={styles.statsGrid}>
                {statItems.map((item, index) => {
                    const anim = statAnims[index];
                    return (
                        <Animated.View
                            key={item.label}
                            style={[
                                styles.statSlot,
                                {
                                    opacity: anim,
                                    transform: [
                                        {
                                            translateY: anim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [14, 0],
                                            }),
                                        },
                                        {
                                            scale: anim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.97, 1],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <GymCard elevated style={styles.statCard}>
                                <Ionicons name={item.icon} size={24} color={colors.accent} />
                                <Text style={styles.statValue}>{item.value}</Text>
                                <Text style={styles.statLabel}>{item.label}</Text>
                            </GymCard>
                        </Animated.View>
                    );
                })}
            </View>

            {/* ─── Next Day Preview ─── */}
            {nextDayLabel && (
                <Animated.View style={{ opacity: fadeAnim }}>
                    <GymCard elevated style={styles.nextDayCard}>
                        <View style={styles.nextDayHeader}>
                            <Ionicons name="arrow-forward-circle" size={22} color={colors.accent} />
                            <Text style={styles.nextDayTitle}>Sıradaki Antrenman</Text>
                        </View>
                        <Text style={styles.nextDayLabel}>{nextDayLabel}</Text>
                        <Text style={styles.nextDayHint}>
                            Ana sayfaya dön, yarınki antrenman hazır olacak.
                        </Text>
                    </GymCard>
                </Animated.View>
            )}

            {trimmedNotes ? (
                <Animated.View style={[styles.noteActionWrap, { opacity: fadeAnim }]}>
                    <AnimatedPressable
                        style={styles.noteActionPressable}
                        onPress={() => setNotesVisible(true)}
                        pressedScale={0.985}
                    >
                        <View style={styles.noteActionBtn}>
                            <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                            <Text style={styles.noteActionText}>Notları Görüntüle</Text>
                        </View>
                    </AnimatedPressable>
                </Animated.View>
            ) : null}

            {cardioBlocks && cardioBlocks.length > 0 ? (
                <Animated.View style={[styles.cardioWrap, { opacity: fadeAnim }]}>
                    <GymCard elevated style={styles.cardioCard}>
                        <View style={styles.cardioHeader}>
                            <Ionicons name="pulse-outline" size={20} color={colors.accent} />
                            <Text style={styles.cardioTitle}>Kardiyo</Text>
                        </View>
                        <Text style={styles.cardioSummary}>{summarizeCardioBlocks(cardioBlocks)}</Text>
                        {cardioBlocks.map((block: any) => (
                            <View key={block.id} style={styles.cardioRow}>
                                <Text style={styles.cardioRowTitle}>{(CARDIO_TYPE_LABELS as any)[block.type] || block.title}</Text>
                                <Text style={styles.cardioRowText}>{summarizeCardioBlock(block)}</Text>
                            </View>
                        ))}
                    </GymCard>
                </Animated.View>
            ) : null}

            {/* ─── Actions ─── */}
            <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
                <AccentButton
                    title="Ana Sayfaya Dön"
                    onPress={handleGoHome}
                    style={{ minHeight: 56 }}
                />
            </Animated.View>
            <NoticeModal
                visible={notesVisible}
                title="Antrenman Notu"
                message={trimmedNotes ?? ""}
                onClose={() => setNotesVisible(false)}
            />
        </ScrollView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl + spacing.xl,
        paddingBottom: spacing.xxxl,
        alignItems: "center",
    },
    trophyWrap: {
        marginBottom: spacing.xl,
        position: "relative",
    },
    sparkleLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 2,
    },
    sparkleDot: {
        position: "absolute",
        borderRadius: 999,
        backgroundColor: colors.accent,
    },
    trophyCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    trophyEmoji: {
        fontSize: 48,
    },
    congratsTitle: {
        fontSize: fontSize.xxl + 4,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
        textAlign: "center",
        marginBottom: spacing.xs,
    },
    congratsSub: {
        fontSize: fontSize.md,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: spacing.xxl,
    },
    statsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        justifyContent: "center",
        width: "100%",
        marginBottom: spacing.xl,
    },
    statSlot: {
        width: "46%",
    },
    statCard: {
        width: "100%",
        alignItems: "center",
        paddingVertical: spacing.lg,
        gap: spacing.xs,
    },
    statValue: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    statLabel: {
        fontSize: fontSize.xs,
        color: colors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    nextDayCard: {
        width: "100%",
        marginBottom: spacing.xl,
        borderColor: colors.accent,
        borderWidth: 1,
    },
    nextDayHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    nextDayTitle: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
    nextDayLabel: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    nextDayHint: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    noteActionWrap: {
        width: "100%",
        marginBottom: spacing.lg,
    },
    noteActionPressable: {
        width: "100%",
    },
    noteActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    noteActionText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    actions: {
        width: "100%",
    },
    cardioWrap: {
        width: "100%",
        marginBottom: spacing.lg,
    },
    cardioCard: {
        width: "100%",
        gap: spacing.sm,
    },
    cardioHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    cardioTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    cardioSummary: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
    },
    cardioRow: {
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cardioRowTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    cardioRowText: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        marginTop: 2,
    },
});
