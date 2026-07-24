import React, { useCallback, useEffect, useRef } from "react";
import { Animated, LayoutChangeEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { AppTourStepKey, useInlineAppTour } from "../contexts/AppTourController";

type InlineTourCardProps = {
    stepKey: AppTourStepKey;
    scrollRef?: React.RefObject<ScrollView | null>;
    scrollOffset?: number;
};

export default function InlineTourCard({ stepKey, scrollRef, scrollOffset = 96 }: InlineTourCardProps) {
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(8)).current;
    const cardRef = useRef<View | null>(null);
    const cardYRef = useRef<number | null>(null);
    const { currentIndex, currentStep, isActiveStep, next, previous, skip, total } = useInlineAppTour();
    const active = isActiveStep(stepKey);

    const scrollToCard = useCallback(() => {
        if (!active || !scrollRef?.current || cardYRef.current === null) return;
        const scrollToY = (y: number) => {
            scrollRef.current?.scrollTo({
                y: Math.max(0, y - scrollOffset),
                animated: true,
            });
        };

        const scrollNode = scrollRef.current as any;
        const targetNode = cardRef.current as any;
        const measureRelativeTo =
            typeof scrollNode?.getScrollableNode === "function" ? scrollNode.getScrollableNode() : scrollNode;

        if (targetNode && measureRelativeTo && typeof targetNode.measureLayout === "function") {
            try {
                targetNode.measureLayout(
                    measureRelativeTo,
                    (_x: number, y: number) => scrollToY(y),
                    () => scrollToY(cardYRef.current ?? 0),
                );
                return;
            } catch {
                // Fall through to the layout value captured by onLayout.
            }
        }

        scrollToY(cardYRef.current);
    }, [active, scrollOffset, scrollRef]);

    const handleLayout = useCallback(
        (event: LayoutChangeEvent) => {
            cardYRef.current = event.nativeEvent.layout.y;
            window.setTimeout(scrollToCard, 40);
        },
        [scrollToCard],
    );

    useEffect(() => {
        if (!active) {
            opacity.setValue(0);
            translateY.setValue(8);
            return;
        }
        const scrollTimers = [80, 320, 680, 1080].map((delay) => window.setTimeout(scrollToCard, delay));
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 180,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();
        return () => {
            scrollTimers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [active, opacity, scrollToCard, translateY]);

    if (!active || !currentStep) return null;

    const isLast = currentIndex >= total - 1;

    return (
        <Animated.View
            ref={cardRef}
            collapsable={false}
            onLayout={handleLayout}
            style={[styles.card, { opacity, transform: [{ translateY }] }]}
        >
            <View style={styles.header}>
                <View style={styles.badge}>
                    <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
                    <Text style={styles.badgeText}>Uygulama turu</Text>
                </View>
                <Text style={styles.counter}>{currentIndex + 1}/{total}</Text>
            </View>
            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.body}>{currentStep.body}</Text>
            <View style={styles.actions}>
                <TouchableOpacity activeOpacity={0.82} onPress={skip} style={styles.secondaryButton}>
                    <Text style={styles.secondaryText}>Geç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={currentIndex === 0}
                    onPress={previous}
                    style={[styles.secondaryButton, currentIndex === 0 && styles.disabledButton]}
                >
                    <Text style={[styles.secondaryText, currentIndex === 0 && styles.disabledText]}>Geri</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.88} onPress={next} style={styles.primaryButton}>
                    <Text style={styles.primaryText}>{isLast ? "Turu tamamla" : "Sonraki"}</Text>
                    <Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={16} color="#050505" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        card: {
            marginTop: spacing.sm,
            marginBottom: spacing.md,
            borderWidth: 1,
            borderColor: colors.accent,
            borderRadius: 12,
            backgroundColor: colors.surface,
            padding: spacing.md,
            shadowColor: colors.accent,
            shadowOpacity: 0.16,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
        },
        header: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
        },
        badge: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
        },
        badgeText: {
            color: colors.accent,
            fontSize: fontSize.xs,
            fontWeight: fontWeight.bold,
            textTransform: "uppercase",
        },
        counter: {
            color: colors.textMuted,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
        },
        title: {
            color: colors.text,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            marginBottom: spacing.xs,
        },
        body: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            lineHeight: 20,
        },
        actions: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        secondaryButton: {
            minHeight: 42,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
            alignItems: "center",
            justifyContent: "center",
        },
        disabledButton: {
            opacity: 0.42,
        },
        secondaryText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
        },
        disabledText: {
            color: colors.textMuted,
        },
        primaryButton: {
            minHeight: 42,
            flex: 1,
            borderRadius: 10,
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.xs,
        },
        primaryText: {
            color: "#050505",
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
        },
    });
