import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
    useSharedValue, useAnimatedStyle,
    withRepeat, withSequence, withTiming, Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const T = {
    bg: '#0D0D0D', surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    accent: '#CCFF00', accentFill: 'rgba(204,255,0,0.05)',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.22)',
    r: 16, px: 28,
} as const;

const FEATURES = [
    'Antrenmanlarını kaydet, PR\'larını takip et',
    'Haftalık hacim ve yoğunluk analizleri',
    'Hedefine özel kişiselleştirilmiş programlar',
];

interface Props { firstName: string; onNext: () => void; }

export default function OnboardingWelcome({ firstName, onNext }: Props) {
    const badgeScale = useSharedValue(1);

    useEffect(() => {
        badgeScale.value = withRepeat(
            withSequence(
                withTiming(1.06, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
                withTiming(1.00, { duration: 2400, easing: Easing.inOut(Easing.sin) })
            ), -1, false
        );
    }, []);

    const badgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
        shadowOpacity: 0.25 + (badgeScale.value - 1) * 4,
    }));

    return (
        <View style={s.root}>
            {/* Monogram */}
            <View style={s.topRow}>
                <Animated.View style={[s.badgeWrap, badgeStyle]}>
                    <View style={s.badge}>
                        <Ionicons name="barbell" size={15} color="#000" />
                    </View>
                </Animated.View>
                <Text style={s.wordmark}>SmartProgress</Text>
            </View>

            {/* Hero editorial text */}
            <View style={s.hero}>
                <Text style={s.heroLine}>Antrenmanını</Text>
                <Text style={s.heroLine}>bir üst seviyeye</Text>
                <Text style={[s.heroLine, { color: T.accent }]}>taşı.</Text>
                <Text style={s.heroSub}>
                    {firstName ? `Merhaba ${firstName}. ` : ''}Seni tanıyalım, hedeflerine göre programını oluşturalım.
                </Text>
            </View>

            {/* Feature bullets */}
            <View style={s.features}>
                {FEATURES.map((f, i) => (
                    <View key={i} style={s.featureRow}>
                        <View style={s.dot} />
                        <Text style={s.featureText}>{f}</Text>
                    </View>
                ))}
            </View>

            {/* CTA */}
            <View style={s.footer}>
                <TouchableOpacity style={s.btn} onPress={onNext} activeOpacity={0.82}>
                    <Text style={s.btnText}>Başlayalım</Text>
                    <Ionicons name="arrow-forward" size={18} color="#000" />
                </TouchableOpacity>
                <Text style={s.note}>Yaklaşık 2 dakika sürer · İstediğin zaman değiştirebilirsin</Text>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg, paddingHorizontal: T.px, paddingTop: 56, paddingBottom: 40 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 48 },
    badgeWrap: { shadowColor: T.accent, shadowOffset: { width: 0, height: 0 }, shadowRadius: 16, borderRadius: 8 },
    badge: { width: 30, height: 30, borderRadius: 8, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontSize: 11, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
    wordmark: { fontSize: 13, fontWeight: '600', color: T.muted, letterSpacing: 0.5 },
    hero: { flex: 1, justifyContent: 'center', gap: 2 },
    heroLine: { fontSize: 44, fontWeight: '800', color: T.text, letterSpacing: -0.5, lineHeight: 50 },
    heroSub: { fontSize: 15, color: T.sub, lineHeight: 22, marginTop: 20 },
    features: { gap: 18, marginBottom: 40 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.accent },
    featureText: { fontSize: 14, color: T.sub, flex: 1, lineHeight: 20 },
    footer: { gap: 14 },
    btn: {
        height: 54, borderRadius: T.r, backgroundColor: T.accent,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#000' },
    note: { fontSize: 12, color: T.muted, textAlign: 'center' },
});
