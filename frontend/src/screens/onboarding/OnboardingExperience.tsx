import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useOnboarding, ExperienceLevel } from "./OnboardingContext";
import { useTheme } from "../../hooks/ThemeContext";

const T = {
    bg: '#0D0D0D', surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    accent: '#CCFF00', accentFill: 'rgba(204,255,0,0.05)', accentBorder: 'rgba(204,255,0,0.55)',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.22)',
    r: 16, px: 28,
} as const;

const LEVELS = [
    {
        id: 'beginner' as ExperienceLevel, emoji: '🌱', label: 'Başlangıç', years: '0 – 1 yıl',
        desc: 'Temel hareketleri öğreniyor, alışkanlık oluşturuyorsun.', color: '#4ADE80',
        guidance: { title: 'Rehberli Antrenman', points: ['Form ipuçları ve teknik rehberlik', 'Hazır başlangıç programları', 'Haftalık ilerleme takibi'], yes: 'Rehberliği Aç', no: 'Kendi Başıma Denerim' },
    },
    {
        id: 'intermediate' as ExperienceLevel, emoji: '💪', label: 'Orta Seviye', years: '1 – 3 yıl',
        desc: 'Temel hareketlere hakimsin, ilerleme planlıyorsun.', color: '#F59E0B',
        guidance: { title: 'Akıllı Antrenman Asistanı', points: ['Progresyon analizi ve öneriler', 'Zayıf nokta tespiti', 'PR takibi ve hedef belirleme'], yes: 'Asistanı Etkinleştir', no: 'Şimdilik Gerek Yok' },
    },
    {
        id: 'advanced' as ExperienceLevel, emoji: '🔥', label: 'İleri Seviye', years: '3+ yıl',
        desc: 'Kendi programlarını oluşturuyor, derinlemesine analiz istiyorsun.', color: '#EF4444',
        guidance: { title: 'Pro Araçlar', points: ['Hacim ve yoğunluk analizi', 'RPE / RIR tracking', 'Gelişmiş istatistik dashboard'], yes: 'Pro Modu Aç', no: 'Standart Devam Et' },
    },
];

function LevelCard({ lv, selected, onPress }: { lv: typeof LEVELS[0]; selected: boolean; onPress: () => void }) {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const handle = useCallback(() => {
        scale.value = withSpring(0.97, { damping: 12, stiffness: 300 }, () => { scale.value = withSpring(1, { damping: 14 }); });
        onPress();
    }, [onPress]);
    const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
        <Animated.View style={anim}>
            <TouchableOpacity
                style={[s.lvCard, selected && { borderColor: colors.accentBorder, backgroundColor: colors.accentMuted }]}
                onPress={handle} activeOpacity={1}
            >
                <Text style={s.lvEmoji}>{lv.emoji}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={[s.lvLabel, selected && { color: colors.accent }]}>{lv.label}</Text>
                        <View style={[s.yearBadge, { borderColor: colors.accentBorder }]}>
                            <Text style={[s.yearText, { color: colors.accent }]}>{lv.years}</Text>
                        </View>
                    </View>
                    <Text style={s.lvDesc}>{lv.desc}</Text>
                </View>
                {selected && (
                    <View style={[s.checkDot, { backgroundColor: colors.accent }]}>
                        <Text style={s.checkTxt}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

interface Props { onNext: () => void; onBack: () => void; }

export default function OnboardingExperience({ onNext, onBack }: Props) {
    const { data, update } = useOnboarding();
    const { colors } = useTheme();
    const [show, setShow] = useState(!!data.experienceLevel);

    const select = useCallback((id: ExperienceLevel) => {
        update({ experienceLevel: id });
        setShow(true);
    }, [update]);

    const go = useCallback((enabled: boolean) => {
        update({ guidanceEnabled: enabled });
        onNext();
    }, [update, onNext]);

    const sel = LEVELS.find(l => l.id === data.experienceLevel);

    return (
        <View style={s.root}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <Text style={s.sectionLabel}>DENEYİM SEVİYESİ</Text>
                <Text style={s.title}>Seni daha iyi tanıyalım.</Text>
                <Text style={s.body}>Seviyene göre program ve rehberlik sunacağız.</Text>

                <View style={s.levels}>
                    {LEVELS.map(lv => (
                        <LevelCard key={lv.id} lv={lv} selected={data.experienceLevel === lv.id} onPress={() => select(lv.id)} />
                    ))}
                </View>

                {show && sel && (
                    <Animated.View entering={FadeIn.duration(240)} style={[s.guidCard, { borderColor: colors.accentBorder }]}>
                        <Text style={s.guidLabel}>ÖNERİLEN ARAÇLAR</Text>
                        <Text style={s.guidTitle}>{sel.guidance.title}</Text>
                        <View style={s.points}>
                            {sel.guidance.points.map((p, i) => (
                                <View key={i} style={s.pointRow}>
                                    <View style={[s.pointDot, { backgroundColor: colors.accent }]} />
                                    <Text style={s.pointText}>{p}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={s.guidNote}>Ayarlardan istediğin zaman değiştirebilirsin.</Text>
                        <TouchableOpacity style={[s.yesBtn, { backgroundColor: colors.accent }]} onPress={() => go(true)} activeOpacity={0.82}>
                            <Text style={s.yesTxt}>{sel.guidance.yes}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.noBtn} onPress={() => go(false)} activeOpacity={0.7}>
                            <Text style={s.noTxt}>{sel.guidance.no}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },
    scroll: { paddingHorizontal: T.px, paddingTop: 24, paddingBottom: 48, gap: 16 },
    sectionLabel: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
    title: { fontSize: 26, fontWeight: '700', color: T.text, letterSpacing: -0.3 },
    body: { fontSize: 14, color: T.sub, lineHeight: 20 },
    levels: { gap: 10, marginTop: 4 },
    lvCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 14,
        backgroundColor: T.surface, borderRadius: T.r, borderWidth: 1, borderColor: T.border,
        padding: 18,
    },
    lvEmoji: { fontSize: 26, lineHeight: 32 },
    lvLabel: { fontSize: 15, fontWeight: '700', color: T.text },
    yearBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    yearText: { fontSize: 11, fontWeight: '600' },
    lvDesc: { fontSize: 13, color: T.sub, lineHeight: 18 },
    checkDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    checkTxt: { fontSize: 10, fontWeight: '800', color: '#000' },
    // Guidance
    guidCard: {
        backgroundColor: T.surface, borderRadius: T.r,
        borderWidth: 1, borderColor: T.accentBorder,
        padding: 20, gap: 14, marginTop: 4,
    },
    guidLabel: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
    guidTitle: { fontSize: 17, fontWeight: '700', color: T.text },
    points: { gap: 10 },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pointDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: T.accent },
    pointText: { fontSize: 14, color: T.sub, flex: 1 },
    guidNote: { fontSize: 12, color: T.muted, fontStyle: 'italic' },
    yesBtn: { height: 50, borderRadius: 14, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
    yesTxt: { fontSize: 15, fontWeight: '700', color: '#000' },
    noBtn: { height: 42, alignItems: 'center', justifyContent: 'center' },
    noTxt: { fontSize: 14, color: T.muted },
});
