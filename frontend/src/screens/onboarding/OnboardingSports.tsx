import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useOnboarding } from "./OnboardingContext";
import { useTheme } from "../../hooks/ThemeContext";

const T = {
    bg: '#0D0D0D', surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    accent: '#3B82F6', accentFill: 'rgba(59, 130, 246,0.05)', accentBorder: 'rgba(59, 130, 246,0.55)',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.22)',
    r: 16, px: 28,
} as const;

const GAP = 10;

const SPORTS = [
    { id: 'fitness',       emoji: '🏋️',  label: 'Fitness',          sub: 'Bodybuilding' },
    { id: 'powerlifting',  emoji: '🏋️‍♂️', label: 'Powerlifting',     sub: 'Squat · Bench · Dead' },
    { id: 'streetlifting', emoji: '💪',  label: 'Streetlifting',    sub: 'Ağırlıklı Calisthenics' },
    { id: 'calisthenics',  emoji: '🤸',  label: 'Calisthenics',     sub: 'Vücut Ağırlığı' },
    { id: 'crossfit',      emoji: '🔥',  label: 'CrossFit',         sub: 'Fonksiyonel' },
    { id: 'running',       emoji: '🏃',  label: 'Koşu / Cardio',    sub: 'Dayanıklılık' },
    { id: 'boxing',        emoji: '🥊',  label: 'Dövüş Sporları',   sub: 'Boks · MMA · Muay Thai' },
    { id: 'team',          emoji: '⚽',  label: 'Takım Sporları',   sub: 'Futbol · Basketbol' },
    { id: 'yoga',          emoji: '🧘',  label: 'Yoga / Pilates',   sub: 'Esneklik & Core' },
    { id: 'swimming',      emoji: '🏊',  label: 'Yüzme',            sub: 'Su Sporları' },
    { id: 'cycling',       emoji: '🚴',  label: 'Bisiklet',         sub: 'Yol / Dağ' },
    { id: 'weightlifting', emoji: '🏅',  label: 'Olympic Lifting',  sub: 'Snatch · C&J' },
];

function SportCard({ sport, selected, onPress }: {
    sport: typeof SPORTS[0]; selected: boolean; onPress: () => void;
}) {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const handlePress = useCallback(() => {
        scale.value = withSpring(0.95, { damping: 12, stiffness: 300 }, () => {
            scale.value = withSpring(1, { damping: 14 });
        });
        onPress();
    }, [onPress]);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Animated.View style={[{ flex: 1 }, animStyle]}>
            <TouchableOpacity
                style={[
                    s.card,
                    selected && {
                        borderColor: colors.accentBorder,
                        backgroundColor: colors.accentMuted,
                    },
                ]}
                onPress={handlePress}
                activeOpacity={1}
            >
                {selected && (
                    <View style={[s.check, { backgroundColor: colors.accent }]}>
                        <Text style={s.checkText}>✓</Text>
                    </View>
                )}
                <Text style={s.emoji}>{sport.emoji}</Text>
                <Text style={[s.cardLabel, selected && { color: colors.accent }]}>{sport.label}</Text>
                <Text style={s.cardSub}>{sport.sub}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

const rows = (arr: typeof SPORTS) => {
    const r = [];
    for (let i = 0; i < arr.length; i += 2) r.push(arr.slice(i, i + 2));
    return r;
};

interface Props { onNext: () => void; onBack: () => void; }

export default function OnboardingSports({ onNext, onBack }: Props) {
    const { data, update } = useOnboarding();
    const { colors } = useTheme();
    const toggle = useCallback((id: string) => {
        const next = data.sports.includes(id) ? data.sports.filter(x => x !== id) : [...data.sports, id];
        update({ sports: next });
    }, [data.sports, update]);
    const can = data.sports.length > 0;

    return (
        <View style={s.root}>
            <View style={s.header}>
                <View style={s.labelRow}>
                    <Text style={s.label}>SPOR TÜRLERİ</Text>
                    {data.sports.length > 0 && (
                        <View style={[s.badge, { borderColor: colors.accentBorder }]}>
                            <Text style={[s.badgeText, { color: colors.accent }]}>{data.sports.length} seçildi</Text>
                        </View>
                    )}
                </View>
                <Text style={s.sub}>Birden fazla seçebilirsin.</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
                {rows(SPORTS).map((row, ri) => (
                    <View key={ri} style={s.row}>
                        {row.map(sp => (
                            <SportCard key={sp.id} sport={sp} selected={data.sports.includes(sp.id)} onPress={() => toggle(sp.id)} />
                        ))}
                    </View>
                ))}
            </ScrollView>

            <View style={s.footer}>
                <TouchableOpacity
                    style={[s.nextBtn, { backgroundColor: colors.accent }, !can && s.nextBtnOff]}
                    onPress={can ? onNext : undefined}
                    activeOpacity={0.82}
                >
                    <Text style={[s.nextText, !can && { color: T.muted }]}>
                        {can ? 'Devam Et' : 'En az 1 spor seç'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },
    header: { paddingHorizontal: T.px, paddingTop: 20, paddingBottom: 16, gap: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
    badge: { borderWidth: 1, borderColor: T.accentBorder, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    badgeText: { fontSize: 11, fontWeight: '600', color: T.accent },
    sub: { fontSize: 14, color: T.sub },
    grid: { paddingHorizontal: T.px, paddingBottom: 16, gap: GAP },
    row: { flexDirection: 'row', gap: GAP },
    card: {
        flex: 1, minHeight: 108, borderRadius: T.r,
        backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 18, paddingHorizontal: 10, gap: 6,
        position: 'relative',
    },
    cardSel: { borderColor: T.accentBorder, backgroundColor: T.accentFill },
    check: {
        position: 'absolute', top: 8, right: 8,
        width: 16, height: 16, borderRadius: 8, backgroundColor: T.accent,
        alignItems: 'center', justifyContent: 'center',
    },
    checkText: { fontSize: 9, fontWeight: '800', color: '#000' },
    emoji: { fontSize: 26 },
    cardLabel: { fontSize: 12, fontWeight: '700', color: T.text, textAlign: 'center' },
    cardSub: { fontSize: 10, color: T.muted, textAlign: 'center' },
    footer: {
        paddingHorizontal: T.px, paddingBottom: 32, paddingTop: 16,
        borderTopWidth: 1, borderTopColor: T.border,
    },
    nextBtn: { height: 52, borderRadius: T.r, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
    nextBtnOff: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border },
    nextText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
