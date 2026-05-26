import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { parseApiError, programApi } from "../services/api";
import { buildCoachProgramData } from "../services/coachRuleEngine";

type Level = "beginner" | "intermediate" | "advanced";
type SplitType = "FB" | "UL" | "AP" | "TL" | "PPL" | "PPLUL";
type Goal = "muscle" | "strength" | "fat_loss" | "general";

type PatternKey =
    | "horizontal_adduction"
    | "upper_chest"
    | "shoulder_flexion"
    | "shoulder_extension"
    | "shoulder_adduction"
    | "upper_back"
    | "shoulder_abduction"
    | "elbow_extension"
    | "elbow_flexion"
    | "reverse_curl"
    | "knee_extension"
    | "leg_press"
    | "hip_hinge"
    | "knee_flexion"
    | "hip_adduction"
    | "spinal_flexion"
    | "calf_raise";

const ACTIVE_PROGRAM_KEY = "active_program_id";

const LEVELS: { key: Level; label: string; desc: string; rir: string }[] = [
    { key: "beginner", label: "Başlangıç", desc: "Form, düzen ve güvenli progress.", rir: "2-3" },
    { key: "intermediate", label: "Orta", desc: "Düşük hacim, tükenişe yakın kaliteli set.", rir: "0-1" },
    { key: "advanced", label: "İleri", desc: "Hata payı düşük, recovery odaklı takip.", rir: "1-2" },
];

const GOALS: { key: Goal; label: string }[] = [
    { key: "muscle", label: "Kas kazanımı" },
    { key: "strength", label: "Güç artışı" },
    { key: "fat_loss", label: "Yağ kaybına destek" },
    { key: "general", label: "Genel progress" },
];

const PRIORITIES: { key: PatternKey; label: string }[] = [
    { key: "shoulder_abduction", label: "Yan omuz" },
    { key: "horizontal_adduction", label: "Göğüs" },
    { key: "upper_chest", label: "Üst göğüs" },
    { key: "shoulder_adduction", label: "Alt kanat" },
    { key: "upper_back", label: "Üst sırt" },
    { key: "elbow_flexion", label: "Biceps" },
    { key: "elbow_extension", label: "Triceps" },
    { key: "leg_press", label: "Bacak" },
    { key: "knee_flexion", label: "Hamstring" },
];

const PATTERN_LABELS: Record<PatternKey, string> = {
    horizontal_adduction: "Göğüs",
    upper_chest: "Üst göğüs",
    shoulder_flexion: "Ön omuz",
    shoulder_extension: "Üst kanat",
    shoulder_adduction: "Alt kanat",
    upper_back: "Üst sırt",
    shoulder_abduction: "Yan omuz",
    elbow_extension: "Triceps",
    elbow_flexion: "Biceps",
    reverse_curl: "Brachialis / ön kol",
    knee_extension: "Quadriceps",
    leg_press: "Vastus / leg press",
    hip_hinge: "Hamstring / glute",
    knee_flexion: "Hamstring",
    hip_adduction: "Adductor",
    spinal_flexion: "Abs",
    calf_raise: "Calf",
};

const EXERCISE_LIBRARY: Record<PatternKey, string[]> = {
    horizontal_adduction: ["Pec Deck", "Smith Machine Bench Press", "Chest Press Machine", "Bench Press"],
    upper_chest: ["Incline Smith Machine Chest Press", "Seated Low to High Fly", "Incline Dumbbell Press"],
    shoulder_flexion: ["Machine Shoulder Press", "Seated Barbell Shoulder Press", "Dumbbell Shoulder Press"],
    shoulder_extension: ["Close Grip Pulldown", "Chest Supported Close Grip Row", "Narrow Grip Pull Up"],
    shoulder_adduction: ["Wide Grip Pulldown", "Wide Grip Pull Up"],
    upper_back: ["Chest Supported Upper Back Row", "Upper Back Row"],
    shoulder_abduction: ["Starting Hip Cable Lateral Raise", "Machine Lateral Raise", "Seated Dumbbell Lateral Raise"],
    elbow_extension: ["Single Arm Triceps Extension", "Triceps Extension"],
    elbow_flexion: ["Preacher Curl", "Cable Bayesian Curl", "Cable Curl"],
    reverse_curl: ["Reverse Cable Curl", "Reverse Barbell Curl"],
    knee_extension: ["Leg Extension", "Sissy Squat"],
    leg_press: ["Leg Press", "Squat", "Hack Squat"],
    hip_hinge: ["Romanian Deadlift", "Stiff Leg Deadlift", "Hyper Extension"],
    knee_flexion: ["Seated Leg Curl", "Leg Curl"],
    hip_adduction: ["Adductor Machine", "Cable Leg Adduction"],
    spinal_flexion: ["Weighted Ab Crunch", "Cable Crunch", "Elbow Supported Knee Raise"],
    calf_raise: ["Straight Leg Calf Raise", "Bent Knee Calf Raise"],
};

const SPLIT_PATTERNS: Record<SplitType, { label: string; days: { label: string; patterns: PatternKey[] }[] }> = {
    FB: {
        label: "Full Body",
        days: [
            { label: "Full Body A", patterns: ["horizontal_adduction", "shoulder_extension", "upper_back", "leg_press", "hip_hinge", "shoulder_abduction", "elbow_extension", "elbow_flexion", "spinal_flexion"] },
            { label: "Full Body B", patterns: ["upper_chest", "shoulder_adduction", "upper_back", "knee_extension", "knee_flexion", "shoulder_abduction", "elbow_extension", "calf_raise"] },
            { label: "Full Body C", patterns: ["horizontal_adduction", "shoulder_extension", "shoulder_adduction", "leg_press", "hip_hinge", "elbow_flexion", "reverse_curl", "spinal_flexion"] },
        ],
    },
    UL: {
        label: "Upper / Lower",
        days: [
            { label: "Upper A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction", "elbow_extension", "elbow_flexion", "reverse_curl"] },
            { label: "Lower A", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Upper B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction", "elbow_extension", "elbow_flexion"] },
            { label: "Lower B", patterns: ["leg_press", "knee_extension", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
    AP: {
        label: "Anterior / Posterior",
        days: [
            { label: "Anterior A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension", "knee_extension", "leg_press", "spinal_flexion"] },
            { label: "Posterior A", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl", "hip_hinge", "knee_flexion", "hip_adduction", "calf_raise"] },
            { label: "Anterior B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension", "knee_extension", "leg_press", "spinal_flexion"] },
            { label: "Posterior B", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl", "hip_hinge", "knee_flexion", "hip_adduction", "calf_raise"] },
        ],
    },
    TL: {
        label: "Torso / Limbs",
        days: [
            { label: "Torso A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction"] },
            { label: "Limbs A", patterns: ["elbow_extension", "elbow_flexion", "reverse_curl", "knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Torso B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction"] },
            { label: "Limbs B", patterns: ["elbow_extension", "elbow_flexion", "reverse_curl", "knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
    PPL: {
        label: "Push / Pull / Legs",
        days: [
            { label: "Push A", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension"] },
            { label: "Pull A", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl"] },
            { label: "Legs A", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Push B", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension"] },
            { label: "Pull B", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl"] },
            { label: "Legs B", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
    PPLUL: {
        label: "PPL + UL",
        days: [
            { label: "Push", patterns: ["horizontal_adduction", "upper_chest", "shoulder_flexion", "shoulder_abduction", "elbow_extension"] },
            { label: "Pull", patterns: ["shoulder_extension", "shoulder_adduction", "upper_back", "elbow_flexion", "reverse_curl"] },
            { label: "Legs", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
            { label: "Upper", patterns: ["horizontal_adduction", "upper_chest", "shoulder_extension", "shoulder_adduction", "upper_back", "shoulder_abduction", "elbow_extension", "elbow_flexion"] },
            { label: "Lower", patterns: ["knee_extension", "leg_press", "hip_hinge", "knee_flexion", "hip_adduction", "spinal_flexion", "calf_raise"] },
        ],
    },
};

function defaultSplitForFrequency(frequency: number): SplitType {
    if (frequency <= 3) return "FB";
    if (frequency === 5) return "PPLUL";
    if (frequency >= 6) return "PPL";
    return "UL";
}

function splitOptionsForFrequency(frequency: number): SplitType[] {
    if (frequency <= 3) return ["FB"];
    if (frequency === 4) return ["UL", "AP", "TL"];
    if (frequency === 5) return ["UL", "AP", "TL", "PPLUL"];
    return ["PPL", "UL", "AP", "TL"];
}

function splitReason(split: SplitType): string {
    if (split === "UL") return "Bacak gelişimi öncelikliyse veya alt/üst düzeni seviyorsan iyi seçim.";
    if (split === "AP") return "Aynı gün göğüs ve sırt çalışmayı sevmiyorsan daha temiz ayrım sunar.";
    if (split === "TL") return "Kollar eksik bölgeyse torso/limbs ayrımı daha uygun olabilir.";
    if (split === "PPLUL") return "5 günlük düzende PPL hissini koruyup haftayı upper/lower ile tamamlar.";
    if (split === "PPL") return "6 günlük düzende yüksek frekanslı, düzenli takip edilebilir split.";
    return "3 gün veya daha az frekansta frekans/verim oranı en iyi başlangıçtır.";
}

function targetRir(level: Level): string {
    if (level === "beginner") return "2-3";
    if (level === "intermediate") return "0-1";
    return "1-2";
}

function reorderForPriority(patterns: PatternKey[], priority: PatternKey | null): PatternKey[] {
    if (!priority || !patterns.includes(priority)) return patterns;
    return [priority, ...patterns.filter((pattern) => pattern !== priority)];
}

export default function PremiumProgramWizardScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [step, setStep] = React.useState(0);
    const [level, setLevel] = React.useState<Level>("intermediate");
    const [frequency, setFrequency] = React.useState(4);
    const [hasPain, setHasPain] = React.useState<"no" | "yes">("no");
    const [painNote, setPainNote] = React.useState("");
    const [goal, setGoal] = React.useState<Goal>("muscle");
    const [equipment, setEquipment] = React.useState("");
    const [sessionMinutes, setSessionMinutes] = React.useState("");
    const [priority, setPriority] = React.useState<PatternKey | null>(null);
    const [avoidNote, setAvoidNote] = React.useState("");
    const [split, setSplit] = React.useState<SplitType>("UL");
    const [selectedExercises, setSelectedExercises] = React.useState<Record<PatternKey, string>>({} as Record<PatternKey, string>);
    const [saving, setSaving] = React.useState(false);
    const [createdProgramId, setCreatedProgramId] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);

    React.useEffect(() => {
        const recommended = defaultSplitForFrequency(frequency);
        const options = splitOptionsForFrequency(frequency);
        if (!options.includes(split)) setSplit(recommended);
    }, [frequency, split]);

    const selectedSplit = SPLIT_PATTERNS[split];
    const workoutDays = selectedSplit.days.slice(0, frequency).map((day) => ({
        ...day,
        patterns: reorderForPriority(day.patterns, priority),
    }));

    const uniquePatterns = Array.from(new Set(workoutDays.flatMap((day) => day.patterns)));

    const resolveExercise = (pattern: PatternKey) => selectedExercises[pattern] || EXERCISE_LIBRARY[pattern][0];

    const programName = `SmartProgress ${selectedSplit.label}`;

    const buildProgramData = () => buildCoachProgramData({
        frequency,
        split,
        level,
        goal,
        hasPain,
        painNote,
        equipment,
        sessionMinutes,
        priority,
        avoidNote,
        selectedExercises,
    });

    const canContinue = step !== 2 || hasPain === "no" || painNote.trim().length > 1;

    const goNext = () => {
        if (!canContinue) {
            setNotice("Ağrı veya sakatlık varsa kısa bir not ekleyelim. Koç önerileri bu bilgiye göre daha güvenli davranır.");
            return;
        }
        setNotice(null);
        setStep((current) => Math.min(current + 1, 7));
    };

    const goBack = () => {
        if (createdProgramId) {
            navigation.goBack();
            return;
        }
        setStep((current) => Math.max(current - 1, 0));
    };

    const saveProgram = async (activate: boolean) => {
        setSaving(true);
        setNotice(null);
        try {
            const response = await programApi.create({
                name: programName,
                description: "SmartProgress Akıllı Koç wizard ile oluşturuldu.",
                isPublic: false,
                frequency,
                data: buildProgramData(),
            });
            const programId = response.data?.id;
            if (activate && programId) {
                await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, programId);
            }
            setCreatedProgramId(programId || "created");
            setNotice(activate ? "Program oluşturuldu ve aktif takibe alındı." : "Program oluşturuldu ve kütüphanene eklendi.");
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice(apiError.message || "Program oluşturulamadı.");
        } finally {
            setSaving(false);
        }
    };

    const renderStep = () => {
        if (createdProgramId) {
            return (
                <View style={styles.card}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark" size={32} color={colors.background} />
                    </View>
                    <Text style={styles.cardTitle}>Program hazır</Text>
                    <Text style={styles.bodyText}>{notice}</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("ProgramList")}>
                        <Text style={styles.primaryText}>Kütüphaneye Git</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.secondaryText}>Koç'a Dön</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        switch (step) {
            case 0:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Seviyeni seç</Text>
                        <Text style={styles.bodyText}>RIR ve hacim mantığı seviyene göre kurulacak.</Text>
                        {LEVELS.map((item) => (
                            <OptionCard key={item.key} active={level === item.key} title={item.label} subtitle={`${item.desc} RIR ${item.rir}`} onPress={() => setLevel(item.key)} colors={colors} />
                        ))}
                    </View>
                );
            case 1:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Haftada kaç gün?</Text>
                        <Text style={styles.bodyText}>7 gün resistance training önermiyoruz. 7. gün istenirse kardiyo/mobilite olabilir.</Text>
                        <View style={styles.chipGrid}>
                            {[2, 3, 4, 5, 6].map((day) => (
                                <TouchableOpacity key={day} style={[styles.dayChip, frequency === day && styles.dayChipActive]} onPress={() => setFrequency(day)}>
                                    <Text style={[styles.dayChipText, frequency === day && styles.dayChipTextActive]}>{day}</Text>
                                    <Text style={[styles.dayChipSub, frequency === day && styles.dayChipTextActive]}>gün</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Ağrı veya sakatlık var mı?</Text>
                        <Text style={styles.bodyText}>Ağrı varsa normal progress önerileri durur ve program daha güvenli davranır.</Text>
                        <OptionCard active={hasPain === "no"} title="Yok" subtitle="Normal program kurulumuna devam." onPress={() => setHasPain("no")} colors={colors} />
                        <OptionCard active={hasPain === "yes"} title="Var" subtitle="Kısa not ekle, öneriler buna göre temkinli olsun." onPress={() => setHasPain("yes")} colors={colors} />
                        {hasPain === "yes" && (
                            <TextInput
                                value={painNote}
                                onChangeText={setPainNote}
                                placeholder="Örn: Sağ dizimde squat sırasında ağrı oluyor"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                multiline
                            />
                        )}
                    </View>
                );
            case 3:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Hedef ve ortam</Text>
                        <Text style={styles.bodyText}>Ekipman seçmezsen tam salon erişimi varsayacağız.</Text>
                        {GOALS.map((item) => (
                            <OptionCard key={item.key} active={goal === item.key} title={item.label} onPress={() => setGoal(item.key)} colors={colors} />
                        ))}
                        <TextInput value={equipment} onChangeText={setEquipment} placeholder="Ekipman: boşsa tam salon varsayılır" placeholderTextColor={colors.textMuted} style={styles.input} />
                        <TextInput value={sessionMinutes} onChangeText={setSessionMinutes} placeholder="Session süresi, örn: 75 dk" placeholderTextColor={colors.textMuted} style={styles.input} keyboardType="numeric" />
                    </View>
                );
            case 4:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Öncelik ve kaçınmalar</Text>
                        <Text style={styles.bodyText}>Öncelikli kas ilk etapta set artırmaz; ilgili egzersizleri günün başına alır.</Text>
                        <View style={styles.priorityGrid}>
                            {PRIORITIES.map((item) => (
                                <TouchableOpacity key={item.key} style={[styles.priorityChip, priority === item.key && styles.priorityChipActive]} onPress={() => setPriority(priority === item.key ? null : item.key)}>
                                    <Text style={[styles.priorityText, priority === item.key && styles.priorityTextActive]}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput value={avoidNote} onChangeText={setAvoidNote} placeholder="Kaçındığın/sevmediğin hareket varsa yaz" placeholderTextColor={colors.textMuted} style={styles.input} />
                    </View>
                );
            case 5:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Split seçimi</Text>
                        <Text style={styles.bodyText}>Frekansına uygun splitleri gösteriyoruz. Bilgisizsen açıklamaya göre seçebilirsin.</Text>
                        {splitOptionsForFrequency(frequency).map((option) => (
                            <OptionCard key={option} active={split === option} title={SPLIT_PATTERNS[option].label} subtitle={splitReason(option)} onPress={() => setSplit(option)} colors={colors} />
                        ))}
                    </View>
                );
            case 6:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Egzersiz seçimi</Text>
                        <Text style={styles.bodyText}>Her patern için önerilen hareketlerden birini seç. Soldan sağa optimallik azalır mantığını burada koruyoruz.</Text>
                        {uniquePatterns.map((pattern) => (
                            <View key={pattern} style={styles.exercisePicker}>
                                <Text style={styles.patternLabel}>{PATTERN_LABELS[pattern]}</Text>
                                {EXERCISE_LIBRARY[pattern].map((exercise) => (
                                    <TouchableOpacity
                                        key={exercise}
                                        style={[styles.exerciseOption, resolveExercise(pattern) === exercise && styles.exerciseOptionActive]}
                                        onPress={() => setSelectedExercises((prev) => ({ ...prev, [pattern]: exercise }))}
                                    >
                                        <Text style={[styles.exerciseOptionText, resolveExercise(pattern) === exercise && styles.exerciseOptionTextActive]}>{exercise}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ))}
                    </View>
                );
            default:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Özet ve oluştur</Text>
                        <Text style={styles.bodyText}>{programName} programı {frequency} günlük frekansla oluşturulacak. RIR hedefi: {targetRir(level)}.</Text>
                        {workoutDays.map((day) => (
                            <View key={day.label} style={styles.summaryDay}>
                                <Text style={styles.summaryDayTitle}>{day.label}</Text>
                                <Text style={styles.summaryDayText}>{day.patterns.map((pattern) => resolveExercise(pattern)).join(", ")}</Text>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.primaryBtn} disabled={saving} onPress={() => saveProgram(true)}>
                            <Text style={styles.primaryText}>{saving ? "Oluşturuluyor..." : "Oluştur ve Aktif Yap"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryBtn} disabled={saving} onPress={() => saveProgram(false)}>
                            <Text style={styles.secondaryText}>Sadece Kütüphaneye Ekle</Text>
                        </TouchableOpacity>
                    </View>
                );
        }
    };

    return (
        <View style={styles.root}>
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                    <Ionicons name={step === 0 || createdProgramId ? "close" : "chevron-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${((createdProgramId ? 8 : step + 1) / 8) * 100}%` }]} />
                </View>
                <Text style={styles.stepText}>{createdProgramId ? "8/8" : `${step + 1}/8`}</Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>AKILLI KOÇ WIZARD</Text>
                    <Text style={styles.title}>Programı birlikte kuralım</Text>
                    <Text style={styles.subtitle}>Rule engine ilk taslağı oluşturur; kararları sen onaylarsın.</Text>
                </View>
                {notice && !createdProgramId && (
                    <View style={styles.notice}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                        <Text style={styles.noticeText}>{notice}</Text>
                    </View>
                )}
                {renderStep()}
            </ScrollView>

            {!createdProgramId && step < 7 && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
                        <Text style={styles.primaryText}>Devam Et</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

function OptionCard({
    active,
    title,
    subtitle,
    onPress,
    colors,
}: {
    active: boolean;
    title: string;
    subtitle?: string;
    onPress: () => void;
    colors: any;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <TouchableOpacity style={[styles.optionCard, active && styles.optionCardActive]} onPress={onPress} activeOpacity={0.82}>
            <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, active && styles.optionTitleActive]}>{title}</Text>
                {subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
            </View>
            <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={22} color={active ? colors.accent : colors.textMuted} />
        </TouchableOpacity>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingTop: 52,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.surfaceElevated,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: colors.accent,
        borderRadius: 2,
    },
    stepText: {
        minWidth: 34,
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        textAlign: "right",
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: spacing.xl,
        paddingBottom: 120,
        gap: spacing.xl,
    },
    hero: {
        gap: spacing.xs,
    },
    eyebrow: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        letterSpacing: 1,
    },
    title: {
        color: colors.text,
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.md,
    },
    cardTitle: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
    },
    bodyText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 21,
    },
    optionCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    optionCardActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    optionCopy: {
        flex: 1,
        gap: spacing.xs,
    },
    optionTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    optionTitleActive: {
        color: colors.accent,
    },
    optionSubtitle: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 19,
    },
    chipGrid: {
        flexDirection: "row",
        gap: spacing.sm,
    },
    dayChip: {
        flex: 1,
        minHeight: 68,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    dayChipActive: {
        backgroundColor: colors.accent,
        borderColor: colors.accent,
    },
    dayChipText: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
    },
    dayChipSub: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    dayChipTextActive: {
        color: colors.background,
    },
    input: {
        minHeight: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        color: colors.text,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: fontSize.sm,
    },
    priorityGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    priorityChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    priorityChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    priorityText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    priorityTextActive: {
        color: colors.accent,
    },
    exercisePicker: {
        gap: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    patternLabel: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    exerciseOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    exerciseOptionActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    exerciseOptionText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    exerciseOptionTextActive: {
        color: colors.accent,
    },
    summaryDay: {
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: spacing.xs,
    },
    summaryDayTitle: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    summaryDayText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    notice: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    noticeText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    footer: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: spacing.xl,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    primaryBtn: {
        minHeight: 52,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
    },
    primaryText: {
        color: colors.background,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    secondaryBtn: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
    },
    secondaryText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    successIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
});
