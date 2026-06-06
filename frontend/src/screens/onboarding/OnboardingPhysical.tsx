import React, { useRef, useEffect, useCallback } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, NativeSyntheticEvent, NativeScrollEvent, Dimensions, Platform,
} from "react-native";
import { useOnboarding } from "./OnboardingContext";
import { useTheme } from "../../hooks/ThemeContext";

const { width: SW } = Dimensions.get('window');

const T = {
    bg: '#0D0D0D', surface: '#141414',
    border: 'rgba(255,255,255,0.06)',
    accent: '#CCFF00', accentFill: 'rgba(204,255,0,0.05)',
    text: '#FFFFFF', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.22)',
    r: 16, px: 28,
} as const;

// ── Picker config ──────────────────────────────
const ITEM_W = 60;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2) * ITEM_W; // items before & after center

const AGES     = Array.from({ length: 67  }, (_, i) => i + 14);
const HCM      = Array.from({ length: 81  }, (_, i) => i + 140);
const HFT      = Array.from({ length: 36  }, (_, i) => i + 55);
const WKG      = Array.from({ length: 221 }, (_, i) => i + 30);
const WLB      = Array.from({ length: 485 }, (_, i) => i + 66);

// ── Scroll Picker ──────────────────────────────
function Picker({
    values, value, onChange, accent,
}: { values: number[]; value: number; onChange: (v: number) => void; accent?: string }) {
    const ref = useRef<ScrollView>(null);
    const mounted = useRef(false);

    useEffect(() => {
        const idx = values.indexOf(value);
        const timer = setTimeout(() => {
            ref.current?.scrollTo({ x: idx * ITEM_W, animated: false });
            mounted.current = true;
        }, 80);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!mounted.current) return;
        const idx = values.indexOf(value);
        if (idx >= 0) ref.current?.scrollTo({ x: idx * ITEM_W, animated: true });
    }, [value, values]);

    const snap = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.max(0, Math.min(values.length - 1, Math.round(x / ITEM_W)));
        if (values[idx] !== value) onChange(values[idx]);
        ref.current?.scrollTo({ x: idx * ITEM_W, animated: true });
    }, [values, value, onChange]);

    return (
        <View style={pk.wrap}>
            {/* Two-line center indicator (not a box) */}
            <View style={pk.indOverlay} pointerEvents="none">
                <View style={pk.indCenter}>
                    <View style={[pk.indLine, { backgroundColor: accent || T.accent }]} />
                    <View style={{ flex: 1 }} />
                    <View style={[pk.indLine, { backgroundColor: accent || T.accent }]} />
                </View>
            </View>
            <ScrollView
                ref={ref}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={ITEM_W}
                decelerationRate="fast"
                onMomentumScrollEnd={snap}
                contentContainerStyle={{ paddingHorizontal: PAD }}
                scrollEventThrottle={16}
                nestedScrollEnabled
                directionalLockEnabled
                bounces={false}
                overScrollMode="never"
                keyboardShouldPersistTaps="handled"
            >
                {values.map((v) => {
                    const dist = Math.abs(v - value);
                    const isC = dist === 0;
                    const op = isC ? 1 : dist === 1 ? 0.42 : dist === 2 ? 0.18 : 0.06;
                    return (
                        <View key={v} style={pk.item}>
                            <Text style={[pk.num, {
                                fontSize: isC ? 26 : dist === 1 ? 20 : 15,
                                fontWeight: isC ? '800' : '400',
                                color: isC ? (accent || T.accent) : T.text,
                                opacity: op,
                            }]}>{v}</Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const pk = StyleSheet.create({
    wrap: { height: 70, overflow: 'hidden', position: 'relative' },
    indOverlay: {
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        alignItems: 'center', zIndex: 1,
    },
    indCenter: { width: ITEM_W, flex: 1 },
    indLine: { height: 1, backgroundColor: 'rgba(204,255,0,0.6)' },
    item: { width: ITEM_W, height: 70, alignItems: 'center', justifyContent: 'center' },
    num: { letterSpacing: -0.5 },
});

// ── Section ────────────────────────────────────
function Section({
    label, value, unit, altUnit, values, onToggle, onChange,
}: {
    label: string; value: number; unit: string; altUnit?: string;
    values: number[]; onToggle?: () => void; onChange: (v: number) => void;
}) {
    const { colors } = useTheme();
    return (
        <View style={sec.root}>
            <View style={sec.labelRow}>
                <Text style={sec.label}>{label}</Text>
                {altUnit && onToggle && (
                    <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={[sec.unitToggle, { color: colors.accent }]}>{unit} / {altUnit}</Text>
                    </TouchableOpacity>
                )}
            </View>
            <View style={sec.numRow}>
                <Text style={sec.bigNum}>{value}</Text>
                <Text style={sec.unit}>{unit}</Text>
            </View>
            <Picker values={values} value={value} onChange={onChange} accent={colors.accent} />
        </View>
    );
}

const sec = StyleSheet.create({
    root: { paddingTop: 28, paddingBottom: 24, paddingHorizontal: T.px },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    label: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
    unitToggle: { fontSize: 12, fontWeight: '600', color: T.accent },
    numRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
    bigNum: { fontSize: 76, fontWeight: '800', color: T.text, letterSpacing: -3, lineHeight: 80 },
    unit: { fontSize: 22, fontWeight: '400', color: T.sub, marginBottom: 12 },
});

const HR = () => <View style={{ height: 1, backgroundColor: T.border, marginHorizontal: T.px }} />;

// ── Main ───────────────────────────────────────
interface Props { onNext: () => void; onBack: () => void; }

export default function OnboardingPhysical({ onNext, onBack }: Props) {
    const { data, update } = useOnboarding();
    const { colors } = useTheme();

    const toggleH = () => data.heightUnit === 'cm'
        ? update({ height: Math.round(data.height / 2.54), heightUnit: 'ft' })
        : update({ height: Math.round(data.height * 2.54), heightUnit: 'cm' });

    const toggleW = () => data.weightUnit === 'kg'
        ? update({ weight: Math.round(data.weight * 2.205), weightUnit: 'lbs' })
        : update({ weight: Math.round(data.weight / 2.205), weightUnit: 'kg' });

    return (
        <View style={s.root}>
            <ScrollView
                style={s.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                directionalLockEnabled={Platform.OS === "ios"}
            >
                <View style={s.heading}>
                    <Text style={s.label}>FİZİKSEL BİLGİLER</Text>
                    <Text style={s.title}>Seni tanıyalım.</Text>
                </View>
                <Section label="YAŞ" value={data.age} unit="yaş" values={AGES} onChange={v => update({ age: v })} />
                <HR />
                <Section
                    label="BOY" value={data.height} unit={data.heightUnit}
                    altUnit={data.heightUnit === 'cm' ? 'ft' : 'cm'}
                    values={data.heightUnit === 'cm' ? HCM : HFT}
                    onToggle={toggleH} onChange={v => update({ height: v })}
                />
                <HR />
                <Section
                    label="KİLO" value={data.weight} unit={data.weightUnit}
                    altUnit={data.weightUnit === 'kg' ? 'lbs' : 'kg'}
                    values={data.weightUnit === 'kg' ? WKG : WLB}
                    onToggle={toggleW} onChange={v => update({ weight: v })}
                />
                <View style={{ height: 24 }} />
            </ScrollView>

            {/* Fixed footer */}
            <View style={s.footer}>
                <TouchableOpacity style={s.skip} onPress={onNext}>
                    <Text style={s.skipText}>Atla</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.next, { backgroundColor: colors.accent }]} onPress={onNext} activeOpacity={0.82}>
                    <Text style={s.nextText}>Devam Et</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: T.bg },
    scroll: { flex: 1 },
    heading: { paddingHorizontal: T.px, paddingTop: 20, paddingBottom: 4, gap: 6 },
    label: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
    title: { fontSize: 26, fontWeight: '700', color: T.text, letterSpacing: -0.3 },
    footer: {
        flexDirection: 'row', gap: 12,
        paddingHorizontal: T.px, paddingTop: 16, paddingBottom: 32,
        borderTopWidth: 1, borderTopColor: T.border,
    },
    skip: {
        flex: 1, height: 50, borderRadius: T.r,
        borderWidth: 1, borderColor: T.border,
        alignItems: 'center', justifyContent: 'center',
    },
    skipText: { fontSize: 14, color: T.sub },
    next: {
        flex: 2, height: 50, borderRadius: T.r,
        backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
    },
    nextText: { fontSize: 15, fontWeight: '700', color: '#000' },
});
