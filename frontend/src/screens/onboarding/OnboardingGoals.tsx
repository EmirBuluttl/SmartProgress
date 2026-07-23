import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useOnboarding, WorkoutGoal } from "./OnboardingContext";
import { useTheme } from "../../hooks/ThemeContext";

const T = {
    bg: '#0D0D0D', surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    accent: '#3B82F6', accentFill: 'rgba(59, 130, 246,0.05)', accentBorder: 'rgba(59, 130, 246,0.55)',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.22)',
    r: 16, px: 28,
} as const;

const GOALS: { id: WorkoutGoal; icon: string; label: string; desc: string; color: string }[] = [
    { id: 'muscle', icon: 'Kas', label: 'Kas Kazanimi', desc: 'Hipertrofi odakli, takip edilebilir progress', color: '#3B82F6' },
    { id: 'strength', icon: 'Guc', label: 'Guc Artisi', desc: 'Olculebilir kuvvet ve compound odagi', color: '#EF4444' },
    { id: 'fat_loss', icon: 'Yag', label: 'Yag Yakma', desc: 'Resistance training ile toparlanabilir tempo', color: '#F59E0B' },
    { id: 'fitness', icon: 'Fit', label: 'Genel Fitness', desc: 'Dengeli programlar ve surdurulebilir aliskanlik', color: '#3B82F6' },
];
const FREQS = [2, 3, 4, 5, 6];
const RECOMMENDED_FREQS = new Set([3, 4, 5]);
const HINTS: Record<number, string> = {
    2: 'Full body split',
    3: 'Full body 3 gun',
    4: 'Upper/Lower, Anterior/Posterior veya Torso/Limbs',
    5: 'PPL+UL, PPL+AP veya PPL+TL',
    6: 'Bolgesel split',
};

function GoalCard({ g, selected, onPress }: { g: typeof GOALS[0]; selected: boolean; onPress: () => void }) {
    const scale = useSharedValue(1);
    const handle = useCallback(() => {
        scale.value = withSpring(0.97, { damping: 12, stiffness: 300 }, () => { scale.value = withSpring(1, { damping: 14 }); });
        onPress();
    }, [onPress]);
    const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <Animated.View style={anim}>
            <TouchableOpacity
                style={[s.goalCard, selected && { borderColor: g.color + '70', backgroundColor: g.color + '08' }]}
                onPress={handle} activeOpacity={1}
            >
                <View style={[s.goalIcon, { borderColor: g.color + '55' }]}>
                    <Text style={[s.goalIconText, { color: g.color }]}>{g.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[s.goalLabel, selected && { color: g.color }]}>{g.label}</Text>
                    <Text style={s.goalDesc}>{g.desc}</Text>
                </View>
                {selected && (
                    <View style={[s.dot, { backgroundColor: g.color }]}>
                        <Text style={s.dotTxt}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

interface Props { onNext: () => void; onBack: () => void; }

export default function OnboardingGoals({ onNext }: Props) {
    const { data, update } = useOnboarding();
    const { colors } = useTheme();
    const can = data.workoutGoal !== null;

    return (
        <View style={s.root}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <Text style={s.sectionLabel}>ANTRENMAN HEDEFI</Text>
                <Text style={s.title}>Ne icin calisiyorsun?</Text>
                <Text style={s.body}>Programin ve onerilerin buna gore sekillenecek.</Text>

                <View style={s.goals}>
                    {GOALS.map(g => (
                        <GoalCard key={g.id} g={g} selected={data.workoutGoal === g.id} onPress={() => update({ workoutGoal: g.id })} />
                    ))}
                </View>

                <View style={s.freqSection}>
                    <Text style={s.sectionLabel}>HAFTALIK SIKLIK</Text>
                    <View style={s.freqRow}>
                        {FREQS.map(f => {
                            const active = data.weeklyFrequency === f;
                            const recommended = RECOMMENDED_FREQS.has(f);
                            return (
                                <TouchableOpacity
                                    key={f}
                                    style={[
                                        s.freqBtn,
                                        recommended && s.freqBtnRecommended,
                                        active && { borderColor: colors.accent, backgroundColor: colors.accentMuted },
                                    ]}
                                    onPress={() => update({ weeklyFrequency: f })}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[s.freqRecommended, active && { color: colors.accent }]}>
                                        {recommended ? "Onerilen" : " "}
                                    </Text>
                                    <Text style={[s.freqNum, active && { color: colors.accent }]}>{f}</Text>
                                    <Text style={[s.freqGun, active && { color: colors.accent }]}>gun</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={s.freqHint}>{HINTS[data.weeklyFrequency]}</Text>
                </View>

                <TouchableOpacity
                    style={[s.nextBtn, { backgroundColor: colors.accent }, !can && s.nextBtnOff]}
                    onPress={can ? onNext : undefined}
                    activeOpacity={0.82}
                >
                    <Text style={[s.nextTxt, !can && { color: T.muted }]}>
                        {can ? 'Devam Et' : 'Hedef Sec'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },
    scroll: { paddingHorizontal: T.px, paddingTop: 24, paddingBottom: 48, gap: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
    title: { fontSize: 26, fontWeight: '700', color: T.text, letterSpacing: 0 },
    body: { fontSize: 14, color: T.sub, lineHeight: 20 },
    goals: { gap: 8, marginTop: 4 },
    goalCard: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: T.surface, borderRadius: T.r, borderWidth: 1, borderColor: T.border, padding: 16,
    },
    goalIcon: { width: 40, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    goalIconText: { fontSize: 11, fontWeight: '800' },
    goalLabel: { fontSize: 14, fontWeight: '700', color: T.text },
    goalDesc: { fontSize: 12, color: T.sub, lineHeight: 17 },
    dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    dotTxt: { fontSize: 10, fontWeight: '800', color: '#000' },
    freqSection: { gap: 12, marginTop: 4 },
    freqRow: { flexDirection: 'row', gap: 8 },
    freqBtn: {
        flex: 1, minHeight: 78, paddingVertical: 10, borderRadius: 12,
        backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
        alignItems: 'center', gap: 2,
    },
    freqBtnRecommended: { borderColor: 'rgba(255,255,255,0.14)' },
    freqRecommended: { minHeight: 14, fontSize: 9, fontWeight: '700', color: T.muted, textTransform: 'uppercase' },
    freqNum: { fontSize: 22, fontWeight: '800', color: 'rgba(255,255,255,0.35)' },
    freqGun: { fontSize: 10, color: T.muted },
    freqHint: { fontSize: 12, color: T.muted, textAlign: 'center', fontStyle: 'italic' },
    nextBtn: { height: 52, borderRadius: T.r, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    nextBtnOff: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
    nextTxt: { fontSize: 15, fontWeight: '700', color: '#000' },
});
