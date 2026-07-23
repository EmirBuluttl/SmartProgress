import React from "react";
import {
    Animated,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Pressable,
    useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const TAB_BAR_HEIGHT = 76;
const FIRST_MEASURE_DELAY_MS = 240;
const SECOND_MEASURE_DELAY_MS = 520;
const FINAL_MEASURE_DELAY_MS = 820;
const MEASURE_GIVE_UP_MS = 1120;
const TARGET_VISIBLE_OPACITY = 0.62;
const TARGET_REVEAL_MS = 180;
const MIN_TARGET_SIZE = 28;
const MAX_TARGET_HEIGHT = 260;
const MAX_TARGET_WIDTH_RATIO = 0.94;
const MAX_TARGET_AREA_RATIO = 0.2;

export default function AppTourOverlay({
    visible,
    step,
    current,
    total,
    getTarget,
    targetVersion,
    onNext,
    onPrevious,
    onSkip,
}: Props) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const opacity = React.useRef(new Animated.Value(0)).current;
    const railY = React.useRef(new Animated.Value(10)).current;
    const targetOpacity = React.useRef(new Animated.Value(0)).current;
    const targetScale = React.useRef(new Animated.Value(0.996)).current;
    const measureRequestRef = React.useRef(0);
    const [targetRect, setTargetRect] = React.useState<TargetRect | null>(null);
    const [targetRectId, setTargetRectId] = React.useState<string | null>(null);
    const [targetPending, setTargetPending] = React.useState(false);

    React.useEffect(() => {
        if (!visible) {
            opacity.setValue(0);
            railY.setValue(10);
            targetOpacity.setValue(0);
            targetScale.setValue(0.996);
            setTargetRect(null);
            setTargetRectId(null);
            setTargetPending(false);
            return;
        }

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 240,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(railY, {
                toValue: 0,
                duration: 360,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [opacity, railY, targetOpacity, targetScale, visible]);

    React.useEffect(() => {
        if (!visible || !step?.targetId) {
            targetOpacity.setValue(0);
            targetScale.setValue(0.996);
            setTargetRect(null);
            setTargetRectId(null);
            setTargetPending(false);
            return;
        }
        let cancelled = false;
        let measured = false;
        let candidateRect: TargetRect | null = null;
        const requestId = measureRequestRef.current + 1;
        measureRequestRef.current = requestId;
        const targetId = step.targetId;

        setTargetPending(true);
        targetOpacity.stopAnimation();
        targetScale.stopAnimation();
        targetOpacity.setValue(0);
        targetScale.setValue(0.996);
        setTargetRect(null);
        setTargetRectId(null);

        const target = getTarget(targetId);
        target?.scrollTo?.();
        target?.action?.();

        const isCurrentRequest = () => !cancelled && measureRequestRef.current === requestId;
        const isUsableRect = (x: number, y: number, width: number, height: number, options?: AppTourTarget | null) => {
            const minWidth = options?.minWidth ?? MIN_TARGET_SIZE;
            const minHeight = options?.minHeight ?? MIN_TARGET_SIZE;
            if (width < minWidth || height < minHeight) return false;
            const visibleTop = insets.top + spacing.xs;
            const visibleBottom = screenHeight - TAB_BAR_HEIGHT - Math.max(insets.bottom, spacing.sm);
            const visibleHeight = visibleBottom - visibleTop;
            if (visibleHeight <= MIN_TARGET_SIZE) return false;
            const maxWidthRatio = options?.maxWidthRatio ?? MAX_TARGET_WIDTH_RATIO;
            const maxHeight = options?.maxHeight ?? MAX_TARGET_HEIGHT;
            if (width > screenWidth * maxWidthRatio) return false;
            if (height > Math.min(maxHeight, visibleHeight * 0.58)) return false;
            const hasHorizontalOverlap = x < screenWidth - spacing.md && x + width > spacing.md;
            const isReasonablyInsideHorizontalViewport = x >= -spacing.sm && x + width <= screenWidth + spacing.sm;
            const isFullyInVerticalViewport = y >= visibleTop - spacing.xs && y + height <= visibleBottom + spacing.xs;
            const paddedWidth = width + (options?.padding ?? spacing.sm) * 2;
            const paddedHeight = height + (options?.padding ?? spacing.sm) * 2;
            const areaRatio = (paddedWidth * paddedHeight) / Math.max(1, screenWidth * visibleHeight);
            if (areaRatio > MAX_TARGET_AREA_RATIO) return false;
            return hasHorizontalOverlap && isReasonablyInsideHorizontalViewport && isFullyInVerticalViewport;
        };
        const isStableRect = (a: TargetRect, b: TargetRect) =>
            Math.abs(a.x - b.x) < 8 &&
            Math.abs(a.y - b.y) < 8 &&
            Math.abs(a.width - b.width) < 8 &&
            Math.abs(a.height - b.height) < 8;
        const revealRect = (rect: TargetRect) => {
            if (!isCurrentRequest()) return;
            measured = true;
            setTargetPending(false);
            setTargetRect(rect);
            setTargetRectId(targetId);
            targetOpacity.setValue(0);
            targetScale.setValue(0.998);
            Animated.parallel([
                Animated.timing(targetOpacity, {
                    toValue: TARGET_VISIBLE_OPACITY,
                    duration: TARGET_REVEAL_MS,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(targetScale, {
                    toValue: 1,
                    duration: TARGET_REVEAL_MS,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        };

        const measure = () => {
            if (!isCurrentRequest() || measured) return;
            const nextTarget = getTarget(targetId);
            const node = nextTarget?.ref.current;
            if (!node?.measureInWindow) {
                if (isCurrentRequest()) setTargetPending(false);
                return;
            }
            node.measureInWindow((x, y, width, height) => {
                if (!isCurrentRequest() || measured) return;
                if (!isUsableRect(x, y, width, height, nextTarget)) return;
                const rect = { x, y, width, height };
                if (candidateRect && isStableRect(candidateRect, rect)) {
                    revealRect(rect);
                    return;
                }
                candidateRect = rect;
            });
        };

        const timers = [
            setTimeout(measure, FIRST_MEASURE_DELAY_MS),
            setTimeout(() => {
                if (!measured) measure();
            }, SECOND_MEASURE_DELAY_MS),
            setTimeout(() => {
                if (!measured) measure();
            }, FINAL_MEASURE_DELAY_MS),
            setTimeout(() => {
                if (!isCurrentRequest() || measured) return;
                const finalTarget = getTarget(targetId);
                if (candidateRect && isUsableRect(candidateRect.x, candidateRect.y, candidateRect.width, candidateRect.height, finalTarget)) {
                    revealRect(candidateRect);
                    return;
                }
                setTargetPending(false);
            }, MEASURE_GIVE_UP_MS),
        ];

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [current, getTarget, insets.bottom, insets.top, screenHeight, screenWidth, step, targetOpacity, targetScale, targetVersion, visible]);

    const paddedRect = React.useMemo(() => {
        if (!targetRect) return null;
        if (targetRectId !== step?.targetId) return null;
        const targetOptions = step?.targetId ? getTarget(step.targetId) : null;
        const visibleTop = insets.top + spacing.xs;
        const visibleBottom = screenHeight - TAB_BAR_HEIGHT - Math.max(insets.bottom, spacing.sm);
        const padding = targetOptions?.padding ?? Math.min(spacing.sm, Math.max(6, Math.round(Math.min(targetRect.width, targetRect.height) * 0.08)));
        const x = Math.max(spacing.sm, targetRect.x - padding);
        const y = Math.max(visibleTop, targetRect.y - padding);
        const maxWidth = screenWidth - x - spacing.sm;
        const maxHeight = visibleBottom - y;
        const width = Math.min(maxWidth, targetRect.width + padding * 2);
        const height = Math.min(maxHeight, targetRect.height + padding * 2);
        if (width < MIN_TARGET_SIZE || height < MIN_TARGET_SIZE) return null;
        if (y + height > visibleBottom + 1) return null;
        return { x, y, width, height };
    }, [getTarget, insets.bottom, insets.top, screenHeight, screenWidth, step?.targetId, targetRect, targetRectId]);

    if (!visible || !step) return null;
    const targetReady = Boolean(paddedRect) && !targetPending;
    const handleLayerNext = () => {
        if (!targetReady) return;
        onNext();
    };

    return (
        <Animated.View pointerEvents="box-none" style={[styles.layer, { opacity }]}>
            <Pressable
                pointerEvents={targetReady ? "auto" : "none"}
                accessibilityRole="button"
                accessibilityLabel="Uygulama turunda sonraki adima gec"
                onPress={handleLayerNext}
                style={StyleSheet.absoluteFill}
            />

            {paddedRect ? (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.targetOutline,
                        {
                            opacity: targetOpacity,
                            transform: [{ scale: targetScale }],
                        },
                        {
                            left: paddedRect.x,
                            top: paddedRect.y,
                            width: paddedRect.width,
                            height: paddedRect.height,
                        },
                    ]}
                >
                    <View style={styles.targetGlow} />
                    <View style={styles.targetBorder} />
                </Animated.View>
            ) : null}

            <Animated.View
                pointerEvents="box-none"
                style={[
                    styles.railWrap,
                    {
                        bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.sm),
                        transform: [{ translateY: railY }],
                    },
                ]}
            >
                <View style={styles.rail}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.max(4, ((current + 1) / total) * 100)}%` }]} />
                    </View>

                    <View style={styles.railHeader}>
                        <View style={styles.iconWrap}>
                            <Ionicons name={step.icon} size={16} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.kicker}>
                                {targetPending ? "Alan hazirlaniyor" : "Uygulama turu"} · {current + 1}/{total}
                            </Text>
                            <Text style={styles.title} numberOfLines={1}>{step.title}</Text>
                        </View>
                    </View>

                    <Text style={styles.body} numberOfLines={3}>{step.body}</Text>

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={onSkip} activeOpacity={0.78}>
                            <Text style={styles.secondaryText}>Gec</Text>
                        </TouchableOpacity>
                        {onPrevious && current > 0 ? (
                            <TouchableOpacity style={styles.secondaryBtn} onPress={onPrevious} activeOpacity={0.78}>
                                <Text style={styles.secondaryText}>Geri</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                            style={[styles.primaryBtn, targetPending && styles.primaryBtnDisabled]}
                            onPress={targetPending ? undefined : onNext}
                            activeOpacity={0.84}
                            disabled={targetPending}
                        >
                            <Text style={styles.primaryText}>{current === total - 1 ? "Turu tamamla" : "Sonraki"}</Text>
                            <Ionicons name={current === total - 1 ? "checkmark" : "arrow-forward"} size={16} color={colors.background} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    layer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 50,
    },
    targetOutline: {
        position: "absolute",
        borderRadius: borderRadius.lg,
        backgroundColor: "transparent",
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 5,
    },
    targetGlow: {
        position: "absolute",
        left: -6,
        right: -6,
        top: -6,
        bottom: -6,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.accent,
        opacity: 0.035,
    },
    targetBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: "transparent",
    },
    railWrap: {
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
    },
    rail: {
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderLight,
        padding: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.26,
        shadowRadius: 18,
        elevation: 14,
    },
    progressTrack: {
        height: 3,
        borderRadius: 99,
        backgroundColor: colors.surfaceElevated,
        overflow: "hidden",
        marginBottom: spacing.sm,
    },
    progressFill: {
        height: "100%",
        borderRadius: 99,
        backgroundColor: colors.accent,
    },
    railHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    iconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentMuted,
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
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        marginTop: 1,
    },
    body: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 19,
        marginBottom: spacing.md,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: spacing.sm,
    },
    secondaryBtn: {
        minHeight: 38,
        minWidth: 72,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
    },
    secondaryText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    primaryBtn: {
        minHeight: 38,
        minWidth: 106,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
    },
    primaryBtnDisabled: {
        opacity: 0.56,
    },
    primaryText: {
        color: colors.background,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
});
