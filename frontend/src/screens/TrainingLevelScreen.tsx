import React from "react";
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authApi } from "../services/api";
import { useAuth } from "../store/AuthContext";
import { useTheme } from "../hooks/ThemeContext";
import { useScreenEnter } from "../hooks/useScreenEnter";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import NoticeModal from "../components/NoticeModal";

const LEVELS = [
    {
        key: "beginner",
        label: "Baslangic",
        summary: "Yeni baslayan veya uzun aradan sonra donen kullanici.",
        detail: "Rehber anlatimlari daha sade olur. RIR, hareket secimi ve program takibi daha cok aciklanir.",
    },
    {
        key: "intermediate",
        label: "Orta",
        summary: "Temel hareketleri bilen, duzenli log tutabilen kullanici.",
        detail: "Koc sinyalleri daha direkt olur. Plato, progress ve hacim kararlarini daha net takip eder.",
    },
    {
        key: "advanced",
        label: "Ileri",
        summary: "RIR/RPE, toparlanma ve programlama kavramlarini bilen kullanici.",
        detail: "Aciklamalar kisalir. Sistem daha cok sinyal, risk ve mudahale adaylarini one cikarir.",
    },
] as const;

type LevelKey = typeof LEVELS[number]["key"];

export default function TrainingLevelScreen() {
    const navigation = useNavigation();
    const { user, updateUser } = useAuth();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const [selected, setSelected] = React.useState<LevelKey>((user?.settings?.training_level as LevelKey) || "beginner");
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);

    const save = async (level: LevelKey) => {
        setSelected(level);
        const settings = { ...user?.settings, training_level: level };
        updateUser({ settings });
        try {
            await authApi.updateProfile({ settings });
            setNotice({ title: "Seviye guncellendi", message: "Koc ve rehber anlatimlari yeni seviyene gore duzenlenecek." });
        } catch {
            setNotice({ title: "Kaydedilemedi", message: "Seviye kaydedilirken bir sorun olustu." });
        }
    };

    return (
        <Animated.View style={[styles.container, { paddingTop: insets.top + spacing.lg }, animStyle]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Kullanici Seviyesi</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Bu ayar neyi degistirir?</Text>
                    <Text style={styles.infoText}>
                        Seviyen, uygulamanin sana bilgiyi ne kadar detayli anlatacagini ve koc sinyallerinin tonunu belirler.
                        Programlarini silmez, loglarini degistirmez.
                    </Text>
                </View>

                {LEVELS.map((level) => {
                    const active = selected === level.key;
                    return (
                        <TouchableOpacity
                            key={level.key}
                            style={[styles.levelCard, active && styles.levelCardActive]}
                            onPress={() => save(level.key)}
                            activeOpacity={0.82}
                        >
                            <View style={styles.levelHeader}>
                                <View style={[styles.radio, active && styles.radioActive]}>
                                    {active ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.levelTitle}>{level.label}</Text>
                                    <Text style={styles.levelSummary}>{level.summary}</Text>
                                </View>
                            </View>
                            <Text style={styles.levelDetail}>{level.detail}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <NoticeModal
                visible={!!notice}
                title={notice?.title || ""}
                message={notice?.message || ""}
                onClose={() => setNotice(null)}
            />
        </Animated.View>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
    iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: borderRadius.md, backgroundColor: colors.surface },
    headerTitle: { flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
    infoCard: { padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    infoTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    infoText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 21, marginTop: spacing.sm },
    levelCard: { padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    levelCardActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    levelHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    radio: { width: 28, height: 28, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
    radioActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    levelTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    levelSummary: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    levelDetail: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.md },
});
