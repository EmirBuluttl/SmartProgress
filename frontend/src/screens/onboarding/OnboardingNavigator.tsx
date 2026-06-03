// ─────────────────────────────────────────────
// OnboardingNavigator — Salt opacity crossfade
// Hiç translateX / translateY yok → sallama imkansız
// ─────────────────────────────────────────────
import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { OnboardingProvider, useOnboarding, type OnboardingData } from "./OnboardingContext";
import OnboardingWelcome from "./OnboardingWelcome";
import OnboardingPhysical from "./OnboardingPhysical";
import OnboardingSports from "./OnboardingSports";
import OnboardingExperience from "./OnboardingExperience";
import OnboardingGoals from "./OnboardingGoals";
import OnboardingReady from "./OnboardingReady";
import { colors, spacing, fontSize, fontWeight, borderRadius } from "../../constants/theme";

const TOTAL = 6;
const PROGRESS_STEPS = 4; // 2-5 arası sayfalar için progress bar

// ── Progress bar ──────────────────────────────
function ProgressBar({ step }: { step: number }) {
    const pct = useSharedValue((step / PROGRESS_STEPS) * 100);

    useEffect(() => {
        pct.value = withTiming((step / PROGRESS_STEPS) * 100, {
            duration: 400,
            easing: Easing.out(Easing.cubic),
        });
    }, [step]);

    const fillStyle = useAnimatedStyle(() => ({
        width: `${pct.value}%` as any,
    }));

    return (
        <View style={pb.track}>
            <Animated.View style={[pb.fill, fillStyle]} />
        </View>
    );
}

const pb = StyleSheet.create({
    track: {
        flex: 1,
        height: 3,
        backgroundColor: colors.surfaceElevated,
        borderRadius: 2,
        overflow: "hidden",
    },
    fill: {
        height: "100%",
        backgroundColor: colors.accent,
        borderRadius: 2,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 6,
    },
});

// ── Ana Navigator İçeriği ─────────────────────
function NavContent({
    firstName,
    onComplete,
}: {
    firstName: string;
    onComplete: (data: OnboardingData) => void;
}) {
    const { data } = useOnboarding();
    const [step, setStep] = useState(1);
    const fadingRef = useRef(false);
    const pendingStep = useRef<number | null>(null);

    // Sayfa opacity — sadece bu değişir, hiç transform yok
    const opacity = useSharedValue(1);

    // ── Geçiş: fade-out → step güncelle → fade-in ──
    // useEffect ile step değişince fade-in başlar
    // Bu React re-render sonrasını garantiler → flash olmaz
    useEffect(() => {
        if (fadingRef.current) {
            fadingRef.current = false;
            opacity.value = withTiming(1, {
                duration: 220,
                easing: Easing.out(Easing.cubic),
            });
        }
    }, [step]);

    const navigate = useCallback((nextStep: number) => {
        if (fadingRef.current) return;
        fadingRef.current = true;

        opacity.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.ease) }, () => {
            runOnJS(setStep)(nextStep);
        });
    }, []);

    const goNext = useCallback(() => {
        if (step >= TOTAL) { onComplete(data); return; }
        navigate(step + 1);
    }, [data, step, navigate, onComplete]);

    const goBack = useCallback(() => {
        if (step <= 1) return;
        navigate(step - 1);
    }, [step, navigate]);

    const pageStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        flex: 1,
    }));

    const showBar = step >= 2 && step <= 5;

    const renderStep = () => {
        switch (step) {
            case 1: return <OnboardingWelcome firstName={firstName} onNext={goNext} />;
            case 2: return <OnboardingPhysical onNext={goNext} onBack={goBack} />;
            case 3: return <OnboardingSports onNext={goNext} onBack={goBack} />;
            case 4: return <OnboardingExperience onNext={goNext} onBack={goBack} />;
            case 5: return <OnboardingGoals onNext={goNext} onBack={goBack} />;
            case 6: return <OnboardingReady onFinish={() => onComplete(data)} firstName={firstName} />;
            default: return null;
        }
    };

    return (
        <View style={s.root}>
            {showBar && (
                <View style={s.topBar}>
                    <TouchableOpacity
                        style={s.backBtn}
                        onPress={goBack}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="chevron-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <ProgressBar step={step - 1} />
                    <Text style={s.stepText}>{step - 1}/{PROGRESS_STEPS}</Text>
                </View>
            )}

            <Animated.View style={pageStyle}>
                {renderStep()}
            </Animated.View>
        </View>
    );
}

// ── Export ────────────────────────────────────
export default function OnboardingNavigator({
    firstName = "Sporcu",
    onComplete,
}: {
    firstName?: string;
    onComplete: (data: OnboardingData) => void;
}) {
    return (
        <OnboardingProvider>
            <NavContent firstName={firstName} onComplete={onComplete} />
        </OnboardingProvider>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.xl,
        paddingTop: 52,
        paddingBottom: spacing.md,
        gap: spacing.md,
    },
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    stepText: {
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold as any,
        color: colors.textMuted,
        minWidth: 26,
        textAlign: "right",
    },
});
