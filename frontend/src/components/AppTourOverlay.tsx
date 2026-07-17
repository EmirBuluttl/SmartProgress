import React from "react";
import {
    Animated,
    Easing,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { AppTourTarget } from "../contexts/AppTourContext";

export type AppTourStep = {
    title: string;
    body: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    tabLabel: string;
    targetId?: string;
    preferredCardPosition?: "top" | "bottom";
};

type Props = {
    visible: boolean;
    step: AppTourStep;
    current: number;
    total: number;
    getTarget: (id: string) => AppTourTarget | null;
    targetVersion?: number;
    onNext: () => void;
    onPrevious?: () => void;
    onSkip: () => void;
};

type TargetRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export default function AppTourOverlay({
    visible,
    step,
    current,
    total,
    getTarget,
    targetVersion = 0,
    onNext,
    onPrevious,
    onSkip,
}: Props) {
    const { colors } = useTheme();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const opacity = React.useRef(new Animated.Value(0)).current;
    const translateY = React.useRef(new Animated.Value(24)).current;
    const pulse = React.useRef(new Animated.Value(0)).current;
    const [targetRect, setTargetRect] = React.useState<TargetRect | null>(null);

    React.useEffect(() => {
        if (!visible) {
            opacity.setValue(0);
            translateY.setValue(24);
            setTargetRect(null);
            return;
        }

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 320,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [opacity, translateY, visible, current]);

    React.useEffect(() => {
        if (!visible) return;
        pulse.setValue(0);
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse, visible]);

    React.useEffect(() => {
        if (!visible || !step?.targetId) return;
        let cancelled = false;
        const targetId = step.targetId;
        setTargetRect(null);
        const target = getTarget(targetId);
        target?.scrollTo?.();
        target?.action?.();

        const measure = () => {
            const nextTarget = getTarget(targetId);
            const node = nextTarget?.ref.current;
            if (!node?.measureInWindow) return;
            node.measureInWindow((x, y, width, height) => {
                if (cancelled || !width || !height) return;
                setTargetRect({ x, y, width, height });
            });
        };

        const timers = [
            setTimeout(measure, 90),
            setTimeout(measure, 360),
            setTimeout(measure, 720),
        ];

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, [current, getTarget, step, targetVersion, visible]);

    const pulseStyle = {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
    };

    const paddedRect = targetRect ? {
        x: Math.max(spacing.md, targetRect.x - spacing.sm),
        y: Math.max(44, targetRect.y - spacing.sm),
        width: Math.min(screenWidth - spacing.md * 2, targetRect.width + spacing.md),
        height: Math.max(50, targetRect.height + spacing.md),
    } : null;
    const cardOnTop = step.preferredCardPosition === "top" || (!!paddedRect && paddedRect.y > screenHeight * 0.48);
    const cardStyle = [
        styles.card,
        cardOnTop ? styles.cardTop : styles.cardBottom,
        { transform: [{ translateY }] },
    ];

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onSkip}>
            <Animated.View style={[styles.overlay, { opacity }]}>
                {paddedRect ? (
                    <View
                        pointerEvents="none"
                        style={[
                            styles.targetSpotlight,
                            {
                                left: paddedRect.x,
                                top: paddedRect.y,
                                width: paddedRect.width,
                                height: paddedRect.height,
                            },
                        ]}
                    >
                        <Animated.View style={[styles.targetPulse, pulseStyle]} />
                        <Ionicons name={step.icon} size={22} color={colors.accent} />
                    </View>
                ) : (
                    <View style={styles.fallbackSpotlight} pointerEvents="none">
                        <Animated.View style={[styles.spotlightPulse, pulseStyle]} />
                        <View style={styles.spotlight}>
                            <Ionicons name={step.icon} size={24} color={colors.accent} />
                            <Text style={styles.spotlightText}>{step.tabLabel}</Text>
                        </View>
                    </View>
                )}

                <Animated.View style={cardStyle}>
                    <View style={styles.handle} />
                    <View style={styles.cardHeader}>
                        <View style={styles.iconWrap}>
                            <Ionicons name={step.icon} size={22} color={colors.background} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.kicker}>Uygulama turu</Text>
                            <Text style={styles.title}>{step.title}</Text>
                        </View>
                        <Text style={styles.counter}>{current + 1}/{total}</Text>
                    </View>

                    <Text style={styles.body}>{step.body}</Text>

                    <View style={styles.dots}>
                        {Array.from({ length: total }).map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    index === current && styles.dotActive,
                                ]}
                            />
                        ))}
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.ghostBtn} onPress={onSkip} activeOpacity={0.78}>
                            <Text style={styles.ghostText}>Gec</Text>
                        </TouchableOpacity>
                        {onPrevious && current > 0 ? (
                            <TouchableOpacity style={styles.ghostBtn} onPress={onPrevious} activeOpacity={0.78}>
                                <Text style={styles.ghostText}>Geri</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.primaryBtn} onPress={onNext} activeOpacity={0.84}>
                            <Text style={styles.primaryText}>{current === total - 1 ? "Basla" : "Sonraki"}</Text>
                            <Ionicons name={current === total - 1 ? "checkmark" : "arrow-forward"} size={17} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.72)",
        paddingHorizontal: spacing.xl,
    },
    fallbackSpotlight: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    spotlightPulse: {
        position: "absolute",
        width: 190,
        height: 190,
        borderRadius: 95,
        backgroundColor: colors.accent,
    },
    spotlight: {
        minWidth: 180,
        minHeight: 112,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        padding: spacing.xl,
    },
    spotlightText: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    targetSpotlight: {
        position: "absolute",
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.accent,
        backgroundColor: "rgba(255,255,255,0.04)",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
    },
    targetPulse: {
        position: "absolute",
        left: -7,
        right: -7,
        top: -7,
        bottom: -7,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.accent,
    },
    card: {
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.borderLight,
        padding: spacing.xl,
    },
    cardTop: {
        top: 64,
    },
    cardBottom: {
        bottom: 88,
    },
    handle: {
        alignSelf: "center",
        width: 44,
        height: 4,
        borderRadius: 99,
        backgroundColor: colors.borderLight,
        marginBottom: spacing.lg,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    kicker: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
    },
    title: {
        color: colors.text,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        marginTop: 2,
    },
    counter: {
        color: colors.textMuted,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    body: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        lineHeight: 22,
    },
    dots: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 7,
        marginTop: spacing.lg,
        marginBottom: spacing.xl,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.borderLight,
    },
    dotActive: {
        width: 22,
        backgroundColor: colors.accent,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: spacing.md,
    },
    ghostBtn: {
        flex: 1,
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: "center",
        justifyContent: "center",
    },
    ghostText: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        fontWeight: fontWeight.semibold,
    },
    primaryBtn: {
        flex: 1.35,
        minHeight: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: spacing.sm,
    },
    primaryText: {
        color: colors.background,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
});
