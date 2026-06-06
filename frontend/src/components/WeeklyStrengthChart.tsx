// ─────────────────────────────────────────────────────────────────────────────
// WeeklyStrengthChart — Özel SVG Güç Trendi Grafiği
// Haftalık ESS (Estimated Strength Score) trendini çizer.
// animationProgress (0→1) ile sol→sağ çizim animasyonu yapar.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
    Circle,
    Defs,
    G,
    Line as SvgLine,
    LinearGradient,
    Path,
    Stop,
    Text as SvgText,
} from "react-native-svg";
import type { WeeklyPoint } from "../utils/workoutMetrics";

interface ChartColors {
    accent: string;
    error: string;
    border: string;
    textSecondary: string;
    textMuted: string;
    surface: string;
    background: string;
}

interface Props {
    data: WeeklyPoint[];
    animationProgress: number; // 0 to 1 — drives left→right reveal
    width: number;
    height?: number;
    colors: ChartColors;
    yLabel?: string; // optional Y axis unit label (e.g. "kg")
}

const PAD = { top: 20, right: 16, bottom: 38, left: 46 };
const GUIDE_COUNT = 4;

// Build a smooth cubic bezier path through points
function buildBezierPath(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    return pts.reduce((d, pt, i) => {
        if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        const prev = pts[i - 1];
        const cx = ((prev.x + pt.x) / 2).toFixed(1);
        return `${d} C ${cx} ${prev.y.toFixed(1)} ${cx} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, "");
}

export default function WeeklyStrengthChart({
    data,
    animationProgress,
    width,
    height = 216,
    colors,
    yLabel,
}: Props) {
    // ── Empty state ──────────────────────────────────────────────────────────
    if (!data || data.length === 0) {
        return (
            <View style={[styles.empty, { width, height }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Henüz yeterli veri yok
                </Text>
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                    Bu egzersizi logladıkça grafik oluşacak
                </Text>
            </View>
        );
    }

    const cw = width - PAD.left - PAD.right;
    const ch = height - PAD.top - PAD.bottom;
    const n = data.length;

    // ── Animated visible slice ───────────────────────────────────────────────
    const rawProgress = animationProgress * n;
    const visibleFull = Math.min(Math.floor(rawProgress), n - 1);
    const fraction = rawProgress - Math.floor(rawProgress);

    // Map each index → SVG coordinates (based on FULL data for stable axis)
    const allEss = data.map((p) => p.ess);
    const rawMin = Math.min(...allEss);
    const rawMax = Math.max(...allEss);
    const essRange = rawMax - rawMin || rawMax * 0.2 || 10;
    const yPad = essRange * 0.28;
    const yMin = rawMin - yPad;
    const yMax = rawMax + yPad;
    const yRange = yMax - yMin;

    const toX = (i: number) =>
        PAD.left + (n === 1 ? cw / 2 : (i / (n - 1)) * cw);
    const toY = (ess: number) =>
        PAD.top + (1 - (ess - yMin) / yRange) * ch;

    const allPts = data.map((p, i) => ({ x: toX(i), y: toY(p.ess), ...p }));

    // Partial visible points with interpolated last point
    let visPts = allPts.slice(0, visibleFull + 1);
    if (fraction > 0.001 && visibleFull < n - 1 && visPts.length >= 1) {
        const last = allPts[visibleFull];
        const next = allPts[visibleFull + 1];
        const ipt = {
            ...last,
            x: last.x + (next.x - last.x) * fraction,
            y: last.y + (next.y - last.y) * fraction,
        };
        visPts = [...visPts.slice(0, -1), ipt];
    }

    const linePath = buildBezierPath(visPts);
    const bottom = PAD.top + ch;
    const fillPath =
        visPts.length > 1
            ? `${linePath} L ${visPts[visPts.length - 1].x.toFixed(1)} ${bottom} L ${visPts[0].x.toFixed(1)} ${bottom} Z`
            : "";

    // ── Guide lines ──────────────────────────────────────────────────────────
    const guides = Array.from({ length: GUIDE_COUNT + 1 }, (_, i) => {
        const ratio = i / GUIDE_COUNT;
        return {
            value: yMin + ratio * yRange,
            y: PAD.top + (1 - ratio) * ch,
        };
    });

    // ── X axis labels — smart spacing ────────────────────────────────────────
    const maxLabels = Math.min(n, 5);
    const step = n <= maxLabels ? 1 : Math.floor(n / maxLabels);
    const xLabels = data
        .map((p, i) => ({
            label: p.weekLabel,
            x: toX(i),
            show: i === 0 || i === n - 1 || i % step === 0,
        }))
        .filter((l) => l.show);

    // ── Dot colors by delta ──────────────────────────────────────────────────
    const getDotColor = (pt: WeeklyPoint) => {
        if (!pt.comparable) return colors.textMuted;
        if (pt.deltaPercent > 0) return colors.accent;
        if (pt.deltaPercent < 0) return colors.error;
        return colors.textSecondary;
    };

    return (
        <Svg width={width} height={height}>
            <Defs>
                <LinearGradient id="essAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.22} />
                    <Stop offset="100%" stopColor={colors.accent} stopOpacity={0.0} />
                </LinearGradient>
            </Defs>

            {/* ── Horizontal guide lines + Y labels ── */}
            {guides.map((g, i) => (
                <G key={`guide-${i}`}>
                    <SvgLine
                        x1={PAD.left}
                        y1={g.y}
                        x2={PAD.left + cw}
                        y2={g.y}
                        stroke={colors.border}
                        strokeWidth={0.5}
                        strokeDasharray="3,5"
                    />
                    <SvgText
                        x={PAD.left - 5}
                        y={g.y + 3.5}
                        fontSize={9}
                        fill={colors.textMuted}
                        textAnchor="end"
                    >
                        {g.value.toFixed(0)}
                    </SvgText>
                </G>
            ))}

            {/* ── Optional Y axis label ── */}
            {!!yLabel && (
                <SvgText
                    x={PAD.left - 5}
                    y={PAD.top - 6}
                    fontSize={8}
                    fill={colors.textMuted}
                    textAnchor="end"
                >
                    {yLabel}
                </SvgText>
            )}

            {/* ── Gradient fill ── */}
            {!!fillPath && (
                <Path d={fillPath} fill="url(#essAreaGrad)" />
            )}

            {/* ── Line ── */}
            {visPts.length > 1 && (
                <Path
                    d={linePath}
                    stroke={colors.accent}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}

            {/* ── Dots — only fully-revealed points ── */}
            {allPts.slice(0, visibleFull + 1).map((pt, i) => {
                const isLast = i === visibleFull && animationProgress >= 0.99;
                const dotColor = getDotColor(pt);
                return (
                    <G key={`dot-${i}`}>
                        {/* Glow ring on the latest point */}
                        {isLast && (
                            <Circle
                                cx={pt.x}
                                cy={pt.y}
                                r={11}
                                fill={dotColor}
                                opacity={0.12}
                            />
                        )}
                        {/* Outer ring */}
                        <Circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isLast ? 5.5 : 4}
                            fill={colors.surface}
                            stroke={dotColor}
                            strokeWidth={2}
                        />
                        {/* Inner fill */}
                        <Circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isLast ? 2.8 : 1.8}
                            fill={dotColor}
                        />
                    </G>
                );
            })}

            {/* ── X axis labels ── */}
            {xLabels.map((l, i) => (
                <SvgText
                    key={`xlabel-${i}`}
                    x={l.x}
                    y={PAD.top + ch + 26}
                    fontSize={9}
                    fill={colors.textMuted}
                    textAnchor="middle"
                >
                    {l.label}
                </SvgText>
            ))}
        </Svg>
    );
}

const styles = StyleSheet.create({
    empty: {
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: "600",
    },
    emptyHint: {
        fontSize: 12,
    },
});
