import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import Animated, {
    useSharedValue, useAnimatedStyle,
    withSpring, withDelay, withTiming, withRepeat, withSequence, Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useOnboarding } from "./OnboardingContext";

const { width: SW, height: SH } = Dimensions.get('window');
const T = {
    bg: '#0D0D0D', surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    accent: '#CCFF00', accentFill: 'rgba(204,255,0,0.05)',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.22)',
    r: 16, px: 28,
} as const;

const GOAL_L: Record<string, string> = { muscle: 'Kas Kazanımı', strength: 'Güç Artışı', fat_loss: 'Yağ Yakma', fitness: 'Genel Fitness', performance: 'Sportif Performans' };
const LEVEL_L: Record<string, string> = { beginner: 'Başlangıç', intermediate: 'Orta Seviye', advanced: 'İleri Seviye' };
const COLS = ['#CCFF00', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C084FC'];

function Piece({ x, delay, color }: { x: number; delay: number; color: string }) {
    const y = useSharedValue(-16);
    const op = useSharedValue(0);
    const rot = useSharedValue(0);
    const sz = 6 + Math.random() * 7;

    useEffect(() => {
        const dur = 1500 + Math.random() * 700;
        op.value = withDelay(delay, withTiming(1, { duration: 80 }));
        y.value = withDelay(delay, withTiming(SH * 0.5, { duration: dur, easing: Easing.in(Easing.quad) }));
        rot.value = withDelay(delay, withRepeat(withTiming(360, { duration: 700 + Math.random() * 400 }), -1, false));
        // fade out
        setTimeout(() => { op.value = withTiming(0, { duration: 350 }); }, delay + dur * 0.72);
    }, []);

    const style = useAnimatedStyle(() => ({
        position: 'absolute' as const, left: x, top: y.value,
        width: sz, height: sz, borderRadius: sz / 5,
        backgroundColor: color, opacity: op.value,
        transform: [{ rotate: `${rot.value}deg` }],
    }));
    return <Animated.View style={style} />;
}

const PIECES = Array.from({ length: 22 }, (_, i) => ({
    id: i, x: Math.random() * SW, delay: Math.random() * 450,
    color: COLS[i % COLS.length],
}));

interface Props { onFinish: () => void; firstName: string; }

export default function OnboardingReady({ onFinish, firstName }: Props) {
    const { data } = useOnboarding();

    const checkScale = useSharedValue(0);
    const checkOp = useSharedValue(0);
    const contentOp = useSharedValue(0);
    const btnScale = useSharedValue(1);

    useEffect(() => {
        checkOp.value = withDelay(150, withTiming(1, { duration: 200 }));
        // Tek yumuşak overshoot — bounce yok
        checkScale.value = withDelay(150, withTiming(1, {
            duration: 500,
            easing: Easing.out(Easing.back(1.15)),
        }));
        contentOp.value = withDelay(480, withTiming(1, { duration: 280 }));
        btnScale.value = withDelay(900, withRepeat(
            withSequence(
                withTiming(1.018, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
                withTiming(1.000, { duration: 1200, easing: Easing.inOut(Easing.sin) })
            ), -1, false
        ));
    }, []);

    const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }], opacity: checkOp.value }));
    const contentStyle = useAnimatedStyle(() => ({ opacity: contentOp.value }));
    const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

    const summary = [
        data.experienceLevel && { icon: 'trophy-outline' as const, label: 'Seviye', val: LEVEL_L[data.experienceLevel] },
        data.workoutGoal     && { icon: 'flag-outline'   as const, label: 'Hedef',  val: GOAL_L[data.workoutGoal] },
        data.weeklyFrequency > 0 && { icon: 'calendar-outline' as const, label: 'Sıklık', val: `Haftada ${data.weeklyFrequency} gün` },
        data.sports.length > 0   && { icon: 'barbell-outline'  as const, label: 'Spor',   val: `${data.sports.length} spor türü` },
    ].filter(Boolean) as { icon: any; label: string; val: string }[];

    return (
        <View style={s.root}>
            {/* Confetti — layout dışı */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {PIECES.map(p => <Piece key={p.id} x={p.x} delay={p.delay} color={p.color} />)}
            </View>

            {/* Check */}
            <Animated.View style={[s.checkWrap, checkStyle]}>
                <View style={s.checkCircle}>
                    <Ionicons name="checkmark" size={52} color="#000" />
                </View>
            </Animated.View>

            {/* İçerik */}
            <Animated.View style={[s.content, contentStyle]}>
                <Text style={s.title}>Her Şey Hazır!</Text>
                <Text style={s.sub}>
                    {firstName ? `${firstName}, antrenman` : 'Antrenman'} yolculuğun SmartProgress ile başlıyor.
                </Text>

                {summary.length > 0 && (
                    <View style={s.summaryCard}>
                        <Text style={s.summaryLabel}>PROFİLİN</Text>
                        {summary.map((it, i) => (
                            <View key={i} style={s.summaryRow}>
                                <Ionicons name={it.icon} size={14} color={T.accent} />
                                <Text style={s.summaryKey}>{it.label}</Text>
                                <Text style={s.summaryVal}>{it.val}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </Animated.View>

            {/* Buttons */}
            <Animated.View style={[s.btns, btnStyle]}>
                <TouchableOpacity style={s.mainBtn} onPress={onFinish} activeOpacity={0.82}>
                    <Ionicons name="barbell" size={18} color="#000" />
                    <Text style={s.mainTxt}>Antrenmanıma Başla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={onFinish} activeOpacity={0.7}>
                    <Text style={s.ghostTxt}>Ana Sayfaya Git</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const s = StyleSheet.create({
    root: {
        flex: 1, backgroundColor: T.bg,
        alignItems: 'center', paddingHorizontal: T.px, paddingTop: 70, paddingBottom: 40,
    },
    checkWrap: {
        shadowColor: T.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.65, shadowRadius: 32,
        borderRadius: 54, marginBottom: 32,
    },
    checkCircle: { width: 108, height: 108, borderRadius: 54, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
    content: { flex: 1, width: '100%', gap: 16, alignItems: 'center' },
    title: { fontSize: 36, fontWeight: '800', color: T.text, textAlign: 'center', letterSpacing: -0.5 },
    sub: { fontSize: 15, color: T.sub, textAlign: 'center', lineHeight: 22 },
    summaryCard: {
        width: '100%', backgroundColor: T.surface, borderRadius: T.r,
        borderWidth: 1, borderColor: T.border, padding: 20, gap: 12,
    },
    summaryLabel: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    summaryKey: { fontSize: 13, color: T.muted, minWidth: 56 },
    summaryVal: { flex: 1, fontSize: 13, fontWeight: '600', color: T.text },
    btns: { width: '100%', gap: 10, paddingTop: 24 },
    mainBtn: {
        height: 56, borderRadius: T.r, backgroundColor: T.accent,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: T.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 12,
    },
    mainTxt: { fontSize: 16, fontWeight: '700', color: '#000' },
    ghostBtn: { height: 42, alignItems: 'center', justifyContent: 'center' },
    ghostTxt: { fontSize: 14, color: T.muted },
});
