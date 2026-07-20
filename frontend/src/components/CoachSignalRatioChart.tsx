import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { borderRadius, fontSize, fontWeight, lineHeight, spacing } from "../constants/theme";
import type { CoachSignalRatioPoint } from "../services/api";

type Props = {
    data: CoachSignalRatioPoint[];
    colors: any;
};

function clampPercent(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

function getVisiblePoints(data: CoachSignalRatioPoint[]) {
    return data.filter((point) => point.workoutCount > 0 || point.analyzedCount > 0);
}

export default function CoachSignalRatioChart({ data, colors }: Props) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const visiblePoints = React.useMemo(() => getVisiblePoints(data), [data]);

    if (visiblePoints.length === 0) {
        return (
            <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Bu hafta oran uretmek icin yeterli karsilastirilabilir log yok.</Text>
                <Text style={styles.emptyText}>
                    Ayni hareketleri kg, tekrar ve RIR ile logladikca koc sinyalleri olusur.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {visiblePoints.map((point) => {
                const progress = clampPercent(point.progressRatio);
                const plateau = clampPercent(point.plateauRatio);
                const regression = clampPercent(point.regressionRatio);
                const neutral = clampPercent(point.watchRatio);

                return (
                    <View key={point.weekStart} style={styles.row}>
                        <View style={styles.labelCol}>
                            <Text style={styles.weekLabel} numberOfLines={1}>{point.weekLabel}</Text>
                            <Text style={styles.countLabel}>{point.analyzedCount} sinyal</Text>
                        </View>
                        <View style={styles.barCol}>
                            <View style={styles.barTrack}>
                                {progress > 0 && <View style={[styles.barSegment, { width: `${progress}%`, backgroundColor: colors.success || "#22C55E" }]} />}
                                {plateau > 0 && <View style={[styles.barSegment, { width: `${plateau}%`, backgroundColor: colors.warning || "#F59E0B" }]} />}
                                {regression > 0 && <View style={[styles.barSegment, { width: `${regression}%`, backgroundColor: colors.error || "#EF4444" }]} />}
                            </View>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaText}>Takip/notr %{neutral.toFixed(1)}</Text>
                                <Text style={styles.metaText}>{point.workoutCount} antrenman</Text>
                            </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            gap: spacing.md,
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        labelCol: {
            width: 76,
            flexShrink: 0,
        },
        weekLabel: {
            color: colors.text,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
        },
        countLabel: {
            color: colors.textMuted,
            fontSize: fontSize.xs,
            marginTop: 2,
        },
        barCol: {
            flex: 1,
            minWidth: 0,
        },
        barTrack: {
            height: 18,
            flexDirection: "row",
            overflow: "hidden",
            borderRadius: borderRadius.full,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
        },
        barSegment: {
            height: "100%",
        },
        metaRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
            marginTop: 5,
        },
        metaText: {
            color: colors.textMuted,
            fontSize: fontSize.xs,
            lineHeight: lineHeight.sm,
        },
        emptyBox: {
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            padding: spacing.md,
            gap: spacing.xs,
        },
        emptyTitle: {
            color: colors.text,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.bold,
            lineHeight: lineHeight.sm,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: fontSize.sm,
            lineHeight: lineHeight.md,
        },
    });
