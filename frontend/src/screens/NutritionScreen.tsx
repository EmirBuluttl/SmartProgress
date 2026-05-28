import React from "react";
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { nutritionApi, parseApiError } from "../services/api";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import GymCard from "../components/GymCard";
import NoticeModal from "../components/NoticeModal";

const SCREEN_WIDTH = Dimensions.get("window").width;
const FIELDS = [
    ["calories", "Kalori", "kcal"],
    ["protein", "Protein", "g"],
    ["carbs", "Karbonhidrat", "g"],
    ["fat", "Yağ", "g"],
] as const;

type FieldKey = typeof FIELDS[number][0];

function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateLabel(value: unknown): string {
    const date = new Date(String(value || ""));
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

export default function NutritionScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const today = new Date().toISOString().slice(0, 10);

    const [logs, setLogs] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [selectedField, setSelectedField] = React.useState<FieldKey>("calories");
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);
    const [form, setForm] = React.useState<Record<string, string>>({
        date: today,
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
        notes: "",
    });

    const loadLogs = React.useCallback(async () => {
        try {
            const res = await nutritionApi.list({ limit: 180 });
            setLogs(res.data.logs || []);
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Beslenme kayıtları yüklenemedi", message: apiError.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            loadLogs();
        }, [loadLogs]),
    );

    const saveLog = async () => {
        try {
            setSaving(true);
            await nutritionApi.save({
                date: form.date || today,
                calories: form.calories,
                protein: form.protein,
                carbs: form.carbs,
                fat: form.fat,
                notes: form.notes || null,
            });
            setForm((prev) => ({ ...prev, notes: "" }));
            await loadLogs();
            setNotice({ title: "Kaydedildi", message: "Kalori ve makro kaydın güncellendi." });
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Kayıt başarısız", message: apiError.message });
        } finally {
            setSaving(false);
        }
    };

    const chartLogs = [...logs]
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
        .filter((log) => toNumber(log[selectedField]) > 0);
    const labelStep = Math.max(1, Math.ceil(chartLogs.length / 5));
    const chartData = chartLogs.length > 0
        ? {
            labels: chartLogs.map((log, index) =>
                index === 0 || index === chartLogs.length - 1 || index % labelStep === 0
                    ? formatDateLabel(log.date)
                    : "",
            ),
            datasets: [{ data: chartLogs.map((log) => toNumber(log[selectedField])) }],
        }
        : { labels: ["-"], datasets: [{ data: [0] }] };
    const selectedMeta = FIELDS.find(([key]) => key === selectedField);
    const trendStart = chartLogs[0] ? toNumber(chartLogs[0][selectedField]) : 0;
    const trendEnd = chartLogs[chartLogs.length - 1] ? toNumber(chartLogs[chartLogs.length - 1][selectedField]) : 0;
    const trendDelta = trendEnd - trendStart;
    const trendPercent = trendStart > 0 ? (trendDelta / trendStart) * 100 : 0;
    const trendUnit = selectedMeta?.[2] ?? "";

    const latest = logs[0];

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} activeOpacity={0.75}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kalori ve Makro</Text>
                <View style={styles.headerButton} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {latest && (
                        <View style={styles.summaryRow}>
                            {FIELDS.map(([key, label, unit]) => (
                                <GymCard key={key} style={styles.summaryCard}>
                                    <Text style={styles.summaryValue}>{latest[key] ?? "-"}</Text>
                                    <Text style={styles.summaryLabel}>{label} {unit}</Text>
                                </GymCard>
                            ))}
                        </View>
                    )}

                    <GymCard elevated style={styles.card}>
                        <Text style={styles.cardTitle}>Günlük kayıt</Text>
                        <TextInput
                            style={styles.input}
                            value={form.date}
                            onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.textMuted}
                        />
                        <View style={styles.grid}>
                            {FIELDS.map(([key, label, unit]) => (
                                <View key={key} style={styles.field}>
                                    <Text style={styles.fieldLabel}>{label}</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={form[key]}
                                        onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))}
                                        placeholder={unit}
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            ))}
                        </View>
                        <TextInput
                            style={[styles.input, styles.notesInput]}
                            value={form.notes}
                            onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
                            placeholder="Not"
                            placeholderTextColor={colors.textMuted}
                            multiline
                        />
                        <TouchableOpacity style={styles.saveButton} onPress={saveLog} disabled={saving} activeOpacity={0.75}>
                            <Text style={styles.saveButtonText}>{saving ? "Kaydediliyor..." : "Kaydet"}</Text>
                        </TouchableOpacity>
                    </GymCard>

                    <GymCard elevated style={styles.card}>
                        <Text style={styles.cardTitle}>Makro grafiği</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
                            {FIELDS.map(([key, label]) => (
                                <TouchableOpacity
                                    key={key}
                                    style={[styles.segment, selectedField === key && styles.segmentActive]}
                                    onPress={() => setSelectedField(key)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[styles.segmentText, selectedField === key && styles.segmentTextActive]}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {chartLogs.length >= 2 ? (
                            <View style={styles.trendSummary}>
                                <Text style={styles.trendLabel}>Overall değişim</Text>
                                <Text style={[styles.trendValue, trendDelta >= 0 ? styles.trendPositive : styles.trendNegative]}>
                                    {trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(selectedField === "calories" ? 0 : 1)} {trendUnit}
                                    {"  "}({trendDelta >= 0 ? "+" : ""}{trendPercent.toFixed(1)}%)
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.trendHint}>Overall trend için en az 2 kayıt gerekir.</Text>
                        )}
                        <LineChart
                            data={chartData}
                            width={SCREEN_WIDTH - spacing.lg * 4}
                            height={190}
                            chartConfig={{
                                backgroundColor: colors.surface,
                                backgroundGradientFrom: colors.surfaceLight,
                                backgroundGradientTo: colors.surface,
                                decimalPlaces: selectedField === "calories" ? 0 : 1,
                                color: (opacity = 1) => {
                                    const hexMatch = colors.accent.match(/\w\w/g);
                                    if (!hexMatch) return `rgba(204, 255, 0, ${opacity})`;
                                    const [r, g, b] = hexMatch.map((h: string) => parseInt(h, 16));
                                    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
                                },
                                labelColor: () => colors.textSecondary,
                                propsForDots: { r: "5", strokeWidth: "2", stroke: colors.accent },
                                propsForBackgroundLines: { stroke: colors.border, strokeWidth: 0.5 },
                            }}
                            bezier
                            style={styles.chart}
                        />
                    </GymCard>

                    <Text style={styles.sectionTitle}>Son kayıtlar</Text>
                    {logs.length === 0 ? (
                        <Text style={styles.emptyText}>Henüz beslenme kaydı yok.</Text>
                    ) : logs.slice(0, 10).map((log) => (
                        <GymCard key={log.id} style={styles.recordCard}>
                            <Text style={styles.recordDate}>{new Date(log.date).toLocaleDateString("tr-TR")}</Text>
                            <Text style={styles.recordText}>
                                {FIELDS.map(([key, label, unit]) => log[key] ? `${label}: ${log[key]}${unit}` : null).filter(Boolean).join(" · ")}
                            </Text>
                            {log.notes ? <Text style={styles.recordNote}>{log.notes}</Text> : null}
                        </GymCard>
                    ))}
                </ScrollView>
            )}

            <NoticeModal
                visible={!!notice}
                title={notice?.title ?? ""}
                message={notice?.message ?? ""}
                onClose={() => setNotice(null)}
            />
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 50,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    headerTitle: { flex: 1, color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: "center" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center" },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
    summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    summaryCard: { width: "48%", gap: 2 },
    summaryValue: { color: colors.accent, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    summaryLabel: { color: colors.textSecondary, fontSize: fontSize.xs },
    card: { gap: spacing.md },
    cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    field: { width: "48%" },
    fieldLabel: { color: colors.textSecondary, fontSize: fontSize.xs, marginBottom: 4 },
    input: {
        minHeight: 44,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        color: colors.text,
        paddingHorizontal: spacing.md,
    },
    notesInput: { minHeight: 72, paddingTop: spacing.sm },
    saveButton: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
    },
    saveButtonText: { color: colors.background, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    segmentRow: { gap: spacing.sm },
    segment: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    segmentActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    segmentText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    segmentTextActive: { color: colors.accent },
    trendSummary: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    trendLabel: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    trendValue: { marginTop: 2, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    trendPositive: { color: colors.accent },
    trendNegative: { color: colors.error },
    trendHint: { color: colors.textMuted, fontSize: fontSize.sm },
    chart: { marginLeft: -spacing.md },
    sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.md },
    emptyText: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
    recordCard: { gap: spacing.xs },
    recordDate: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    recordText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    recordNote: { color: colors.textMuted, fontSize: fontSize.sm, fontStyle: "italic" },
});
