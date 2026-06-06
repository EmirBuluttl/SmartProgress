import React from "react";
import {
    ActivityIndicator,
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { bodyMeasurementApi, parseApiError } from "../services/api";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useScreenEnter } from "../hooks/useScreenEnter";
import GymCard from "../components/GymCard";
import NoticeModal from "../components/NoticeModal";

const SCREEN_WIDTH = Dimensions.get("window").width;
const FIELDS = [
    ["weight", "Kilo", "kg"],
    ["waist", "Bel", "cm"],
    ["chest", "Göğüs", "cm"],
    ["arm", "Kol", "cm"],
    ["leg", "Bacak", "cm"],
    ["hip", "Kalça", "cm"],
    ["shoulder", "Omuz", "cm"],
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

export default function BodyMeasurementsScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const today = new Date().toISOString().slice(0, 10);

    const [records, setRecords] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [selectedField, setSelectedField] = React.useState<FieldKey>("weight");
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);
    const [form, setForm] = React.useState<Record<string, string>>({
        date: today,
        weight: "",
        waist: "",
        chest: "",
        arm: "",
        leg: "",
        hip: "",
        shoulder: "",
        notes: "",
    });

    const loadRecords = React.useCallback(async () => {
        try {
            const res = await bodyMeasurementApi.list({ limit: 180 });
            setRecords(res.data.measurements || []);
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Ölçüler yüklenemedi", message: apiError.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            loadRecords();
        }, [loadRecords]),
    );

    const saveRecord = async () => {
        try {
            setSaving(true);
            await bodyMeasurementApi.save({
                date: form.date || today,
                weight: form.weight,
                waist: form.waist,
                chest: form.chest,
                arm: form.arm,
                leg: form.leg,
                hip: form.hip,
                shoulder: form.shoulder,
                notes: form.notes || null,
            });
            setForm((prev) => ({ ...prev, notes: "" }));
            await loadRecords();
            setNotice({ title: "Kaydedildi", message: "Vücut ölçüsü kaydın güncellendi." });
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Kayıt başarısız", message: apiError.message });
        } finally {
            setSaving(false);
        }
    };

    const chartRecords = [...records]
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())
        .filter((record) => toNumber(record[selectedField]) > 0);
    const labelStep = Math.max(1, Math.ceil(chartRecords.length / 5));
    const chartData = chartRecords.length > 0
        ? {
            labels: chartRecords.map((record, index) =>
                index === 0 || index === chartRecords.length - 1 || index % labelStep === 0
                    ? formatDateLabel(record.date)
                    : "",
            ),
            datasets: [{ data: chartRecords.map((record) => toNumber(record[selectedField])) }],
        }
        : { labels: ["-"], datasets: [{ data: [0] }] };
    const selectedMeta = FIELDS.find(([key]) => key === selectedField);
    const trendStart = chartRecords[0] ? toNumber(chartRecords[0][selectedField]) : 0;
    const trendEnd = chartRecords[chartRecords.length - 1] ? toNumber(chartRecords[chartRecords.length - 1][selectedField]) : 0;
    const trendDelta = trendEnd - trendStart;
    const trendPercent = trendStart > 0 ? (trendDelta / trendStart) * 100 : 0;
    const trendUnit = selectedMeta?.[2] ?? "";

    return (
        <Animated.View style={[styles.root, animStyle]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} activeOpacity={0.75}>
                    <Ionicons name="chevron-back" size={26} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Vücut Ölçüleri</Text>
                <View style={styles.headerButton} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <GymCard elevated style={styles.card}>
                        <Text style={styles.cardTitle}>Yeni kayıt</Text>
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
                        <TouchableOpacity style={styles.saveButton} onPress={saveRecord} disabled={saving} activeOpacity={0.75}>
                            <Text style={styles.saveButtonText}>{saving ? "Kaydediliyor..." : "Kaydet"}</Text>
                        </TouchableOpacity>
                    </GymCard>

                    <GymCard elevated style={styles.card}>
                        <Text style={styles.cardTitle}>Progress grafiği</Text>
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
                        {chartRecords.length >= 2 ? (
                            <View style={styles.trendSummary}>
                                <Text style={styles.trendLabel}>Overall değişim</Text>
                                <Text style={[styles.trendValue, trendDelta >= 0 ? styles.trendPositive : styles.trendNegative]}>
                                    {trendDelta >= 0 ? "+" : ""}{trendDelta.toFixed(1)} {trendUnit}
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
                                decimalPlaces: 1,
                                color: (opacity = 1) => {
                                    const hexMatch = colors.accent.match(/\w\w/g);
                                    if (!hexMatch) return `rgba(59, 130, 246, ${opacity})`;
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
                    {records.length === 0 ? (
                        <Text style={styles.emptyText}>Henüz ölçü kaydı yok.</Text>
                    ) : records.slice(0, 10).map((record) => (
                        <GymCard key={record.id} style={styles.recordCard}>
                            <Text style={styles.recordDate}>{new Date(record.date).toLocaleDateString("tr-TR")}</Text>
                            <Text style={styles.recordText}>
                                {FIELDS.map(([key, label, unit]) => record[key] ? `${label}: ${record[key]}${unit}` : null).filter(Boolean).join(" · ")}
                            </Text>
                            {record.notes ? <Text style={styles.recordNote}>{record.notes}</Text> : null}
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
        </Animated.View>
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
