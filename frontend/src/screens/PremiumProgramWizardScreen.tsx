import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { RootStackParamList } from "../navigation/RootNavigator";
import { authApi, parseApiError, programApi } from "../services/api";
import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "../data/exerciseLibrary";
import { getExerciseMetadata, riskLevelLabel, skillDemandLabel, stabilityLabel } from "../data/exerciseMetadata";
import { useAuth } from "../store/AuthContext";
import {
    buildCoachProgramData,
    COACH_GOALS as GOALS,
    COACH_LEVELS as LEVELS,
    COACH_PATTERN_LABELS as PATTERN_LABELS,
    COACH_PRIORITY_GROUPS as PRIORITY_GROUPS,
    COACH_PRIORITIES as PRIORITIES,
    COACH_SESSION_DURATIONS as SESSION_DURATIONS,
    COACH_SPLIT_PATTERNS as SPLIT_PATTERNS,
    COACH_STRENGTH_FOCUS_OPTIONS as STRENGTH_FOCUS_OPTIONS,
    applyPrioritySelectionRules,
    defaultSplitForFrequency,
    getAvailableExercises,
    getMachineTypeOptions,
    getTrainingDays,
    getWorkoutDays,
    inferPainLimitedPatterns,
    isInjuryNote,
    isPriorityChoiceLocked,
    parseAvoidedExercises,
    resolveCoachExerciseWithAvoidance,
    splitOptionsForFrequency,
    splitReason,
    targetRir,
    type CoachGoal as Goal,
    type CoachLevel as Level,
    type CoachPatternKey as PatternKey,
    type CoachSessionDuration as SessionDuration,
    type CoachSplitType as SplitType,
    type CoachStrengthFocus as StrengthFocus,
} from "../services/coachRuleEngine";

const ACTIVE_PROGRAM_KEY = "active_program_id";
const PRO_WIZARD_USES = 15;
const EQUIPMENT_LIMIT_CHIPS = [
    "Dumbbell yok",
    "Barbell yok",
    "Kablo yok",
    "Smith machine yok",
    "Makine yok",
    "Sehpa/Bench yok",
    "Rack yok",
    "Direnç bandı yok",
    "Bodyweight/vücut ağırlığı hareketler uygun değil",
];

const normalizeLevel = (value: unknown): Level => {
    const text = String(value || "").toLowerCase();
    if (text === "beginner" || text === "intermediate" || text === "advanced") return text;
    return "intermediate";
};

const normalizeGoal = (value: unknown): Goal => {
    const text = String(value || "").toLowerCase();
    if (text === "muscle" || text === "strength" || text === "fat_loss" || text === "general") return text;
    if (text === "fitness" || text === "performance") return "general";
    return "muscle";
};

const normalizeFrequency = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 4;
    return Math.min(6, Math.max(2, Math.round(parsed)));
};

const getCoachProfileFromSettings = (settings: any) => {
    if (!settings || typeof settings !== "object") return null;
    return settings.coach_profile ||
        settings.coachProfile ||
        settings.onboarding_profile ||
        settings.onboardingProfile ||
        null;
};

const hasActiveProAccess = (user: any) => {
    const tier = String(user?.subscriptionTier || user?.settings?.subscriptionTier || "").toLowerCase();
    const status = String(user?.subscriptionStatus || user?.settings?.subscriptionStatus || "").toLowerCase();
    const expiresAt = user?.settings?.pro_trial_expires_at ? new Date(user.settings.pro_trial_expires_at) : null;
    if (status === "trial" && expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) return false;
    return (tier === "pro" || tier === "coach_plus") && (status === "active" || status === "trial");
};

export default function PremiumProgramWizardScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, updateUser } = useAuth();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const coachProfile = React.useMemo(() => getCoachProfileFromSettings(user?.settings), [user?.settings]);

    const [step, setStep] = React.useState(0);
    const [level, setLevel] = React.useState<Level>(() => normalizeLevel(coachProfile?.experienceLevel || coachProfile?.level));
    const [frequency, setFrequency] = React.useState(() => normalizeFrequency(coachProfile?.weeklyFrequency || coachProfile?.frequency));
    const [hasPain, setHasPain] = React.useState<"no" | "yes">("no");
    const [painNote, setPainNote] = React.useState("");
    const [includePainArea, setIncludePainArea] = React.useState<"no" | "yes">("yes");
    const [goal, setGoal] = React.useState<Goal>(() => normalizeGoal(coachProfile?.workoutGoal || coachProfile?.goal));
    const [strengthFocus, setStrengthFocus] = React.useState<StrengthFocus>("overall");
    const [hasEquipmentLimit, setHasEquipmentLimit] = React.useState<"no" | "yes">("no");
    const [equipmentLimitNote, setEquipmentLimitNote] = React.useState("");
    const [sessionDuration, setSessionDuration] = React.useState<SessionDuration>("60-90");
    const [priorityMode, setPriorityMode] = React.useState<"simple" | "ordered">("simple");
    const [priorityGroup, setPriorityGroup] = React.useState<string | null>(null);
    const [priority, setPriority] = React.useState<PatternKey | null>(null);
    const [priorityOrder, setPriorityOrder] = React.useState<PatternKey[]>([]);
    const [priorityGuidanceEnabled, setPriorityGuidanceEnabled] = React.useState(true);
    const [avoidNote, setAvoidNote] = React.useState("");
    const [split, setSplit] = React.useState<SplitType>("UL");
    const [selectedExercises, setSelectedExercises] = React.useState<Record<PatternKey, string>>({} as Record<PatternKey, string>);
    const [expandedExercisePatterns, setExpandedExercisePatterns] = React.useState<Partial<Record<PatternKey, boolean>>>({});
    const [saving, setSaving] = React.useState(false);
    const [createdProgramId, setCreatedProgramId] = React.useState<string | null>(null);
    const [createdProgramIntro, setCreatedProgramIntro] = React.useState<any>(null);
    const [notice, setNotice] = React.useState<string | null>(null);
    const [exerciseInfo, setExerciseInfo] = React.useState<{ pattern: PatternKey; item: ExerciseLibraryItem; rank: number } | null>(null);
    const [profileApplied, setProfileApplied] = React.useState(false);
    const hasProAccess = hasActiveProAccess(user);
    const freeWizardUsesRemaining = Math.max(0, Number(user?.settings?.free_wizard_uses_remaining ?? 2));
    const proWizardUsesRemaining = Math.max(0, Number(user?.settings?.pro_wizard_uses_remaining ?? PRO_WIZARD_USES));
    const wizardUsesRemaining = hasProAccess ? proWizardUsesRemaining : freeWizardUsesRemaining;

    React.useEffect(() => {
        if (!coachProfile || profileApplied) return;
        setLevel(normalizeLevel(coachProfile.experienceLevel || coachProfile.level));
        setFrequency(normalizeFrequency(coachProfile.weeklyFrequency || coachProfile.frequency));
        setGoal(normalizeGoal(coachProfile.workoutGoal || coachProfile.goal));
        if (coachProfile.hasPain === true || coachProfile.injuryNote || coachProfile.painNote) {
            setHasPain("yes");
            setPainNote(String(coachProfile.injuryNote || coachProfile.painNote || ""));
        }
        setProfileApplied(true);
        setNotice("Onboarding/profil bilgilerinden başlangıç ayarlarını doldurdum. İstersen her adımı yine değiştirebilirsin.");
    }, [coachProfile, profileApplied]);

    React.useEffect(() => {
        const recommended = defaultSplitForFrequency(frequency);
        const options = splitOptionsForFrequency(frequency);
        if (!options.includes(split)) setSplit(recommended);
    }, [frequency, split]);

    const selectedSplit = SPLIT_PATTERNS[split];
    const selectedPriorityGroup = PRIORITY_GROUPS.find((group) => group.key === priorityGroup) || null;
    const painLimitedPatterns = React.useMemo(() => inferPainLimitedPatterns(painNote), [painNote]);
    const injuryMode = React.useMemo(() => hasPain === "yes" && isInjuryNote(painNote), [hasPain, painNote]);
    const machineTypeOptions = React.useMemo(() => getMachineTypeOptions(), []);
    const exerciseSelectionOptions = React.useMemo(() => ({
        hasEquipmentLimit,
        equipmentLimitNote,
        level,
        painNote,
        preferPainSafe: hasPain === "yes" && !injuryMode,
        allowUnsafeFallback: hasPain === "yes" && (injuryMode || includePainArea === "yes"),
        goal,
        strengthFocus,
    }), [equipmentLimitNote, goal, hasEquipmentLimit, hasPain, includePainArea, injuryMode, level, painNote, strengthFocus]);
    const resolveExercise = (pattern: PatternKey) =>
        resolveCoachExerciseWithAvoidance(pattern, selectedExercises, avoidNote, [], exerciseSelectionOptions);
    const activePriorityOrder = React.useMemo(
        () => priorityMode === "ordered" ? priorityOrder : [],
        [priorityMode, priorityOrder],
    );
    const trainingDays = React.useMemo(
        () => getTrainingDays({ frequency, split, priority, priorityOrder: activePriorityOrder }),
        [activePriorityOrder, frequency, priority, split],
    );
    const workoutDays = React.useMemo(
        () => getWorkoutDays({ frequency, split, priority, priorityOrder: activePriorityOrder }),
        [activePriorityOrder, frequency, priority, split],
    );

    const uniquePatterns = React.useMemo(
        () => Array.from(new Set(trainingDays.flatMap((day) => day.patterns))),
        [trainingDays],
    );
    const blockedExercisePatterns = React.useMemo(() => uniquePatterns.filter((pattern) =>
        getAvailableExercises(pattern, avoidNote, [], {
            ...exerciseSelectionOptions,
            allowUnsafeFallback: hasPain === "yes" && (injuryMode || includePainArea === "yes"),
        }).length === 0,
    ), [avoidNote, exerciseSelectionOptions, hasPain, includePainArea, injuryMode, uniquePatterns]);
    const avoidedExerciseTokens = React.useMemo(() => parseAvoidedExercises(avoidNote), [avoidNote]);
    const libraryByName = React.useMemo(() => {
        const map = new Map<string, ExerciseLibraryItem>();
        EXERCISE_LIBRARY.forEach((item) => {
            map.set(item.name, item);
            item.aliases.forEach((alias) => map.set(alias, item));
        });
        return map;
    }, []);

    const programName = `SmartProgress ${selectedSplit.label}`;
    const exerciseSelectionReasons = React.useMemo(() => {
        const reasons = [
            `${LEVELS.find((item) => item.key === level)?.label || "Seviye"} icin stabilite onceligi`,
        ];
        if (hasEquipmentLimit === "yes" && equipmentLimitNote.trim()) reasons.push("Ekipman filtresi aktif");
        if (hasPain === "yes" && painNote.trim()) reasons.push("Agri/sakatlik filtresi aktif");
        if (avoidedExerciseTokens.length > 0) reasons.push("Kacinilan hareketler cikarildi");
        if (goal === "strength") reasons.push("Guc hedefi dikkate alindi");
        if (goal === "fat_loss") reasons.push("Yag kaybi icin toparlanma dikkate alindi");
        return reasons;
    }, [avoidedExerciseTokens.length, equipmentLimitNote, goal, hasEquipmentLimit, hasPain, level, painNote]);
    const hasUpperBackPriorityOverlap = priorityMode === "ordered" &&
        priorityOrder.includes("upper_back") &&
        (priorityOrder.includes("rear_delt") || priorityOrder.includes("trapezius"));
    const exerciseInfoMeta = exerciseInfo ? getExerciseMetadata(exerciseInfo.item) : null;

    const buildProgramData = () => buildCoachProgramData({
        frequency,
        split,
        level,
        goal,
        strengthFocus,
        hasPain,
        painNote,
        includePainArea,
        hasEquipmentLimit,
        equipmentLimitNote,
        sessionDuration,
        priority,
        priorityOrder: activePriorityOrder,
        avoidNote,
        selectedExercises,
    });

    React.useEffect(() => {
        setSelectedExercises((current) => {
            let changed = false;
            const next = { ...current };
            uniquePatterns.forEach((pattern) => {
                const selected = next[pattern];
                if (!selected) return;
                const available = getAvailableExercises(pattern, avoidNote, [], exerciseSelectionOptions);
                if (!available.includes(selected)) {
                    delete next[pattern];
                    changed = true;
                }
            });
            return changed ? next : current;
        });
    }, [avoidNote, exerciseSelectionOptions, uniquePatterns]);

    const canContinue =
        (step !== 2 || hasPain === "no" || painNote.trim().length > 1) &&
        (step !== 6 || blockedExercisePatterns.length === 0);

    const goNext = () => {
        if (!canContinue) {
            if (step === 6 && blockedExercisePatterns.length > 0) {
                setNotice(`Bu filtrelerle hareket bulunamayan alanlar var: ${blockedExercisePatterns.map((pattern) => PATTERN_LABELS[pattern]).join(", ")}. Ekipman veya kaçınma notunu yumuşat.`);
                return;
            }
            setNotice("Ağrı veya sakatlık varsa kısa bir not ekleyelim. Koç önerileri bu bilgiye göre daha güvenli davranır.");
            return;
        }
        setNotice(null);
        setStep((current) => Math.min(current + 1, 7));
    };

    const returnToCoach = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }
        (navigation as any).navigate("MainTabs", { screen: "Coach" });
    };

    const appendEquipmentNote = (note: string) => {
        setEquipmentLimitNote((current) => {
            const trimmed = current.trim();
            if (!trimmed) return note;
            if (trimmed.toLowerCase().includes(note.toLowerCase())) return trimmed;
            return `${trimmed}, ${note}`;
        });
    };

    const goBack = () => {
        if (createdProgramId || step === 0) {
            returnToCoach();
            return;
        }
        setStep((current) => Math.max(current - 1, 0));
    };

    const saveProgram = async (activate: boolean) => {
        if (wizardUsesRemaining <= 0) {
            setNotice(hasProAccess
                ? "Akıllı program wizard hakkın dolmuş görünüyor. Premium kullanıcılar için limit 15 program."
                : "Ücretsiz wizard hakkın dolmuş görünüyor. Premium deneme veya abonelik aktif olduğunda 15 akıllı program hakkın olur.");
            return;
        }
        if (blockedExercisePatterns.length > 0) {
            setNotice(`Bu filtrelerle hareket bulunamayan alanlar var: ${blockedExercisePatterns.map((pattern) => PATTERN_LABELS[pattern]).join(", ")}. Program kaydetmeden önce seçimleri düzelt.`);
            return;
        }
        setSaving(true);
        setNotice(null);
        try {
            const programData = buildProgramData();
            const response = await programApi.create({
                name: programName,
                description: "SmartProgress Akıllı Koç wizard ile oluşturuldu.",
                isPublic: false,
                frequency,
                data: programData,
            });
            const programId = response.data?.id;
            if (activate && programId) {
                await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, programId);
            }
            if (hasProAccess) {
                const nextUses = Math.max(0, proWizardUsesRemaining - 1);
                const updateResponse = await authApi.updateProfile({
                    settings: { pro_wizard_uses_remaining: nextUses },
                });
                if (updateResponse.data) {
                    await updateUser(updateResponse.data);
                }
            } else {
                const nextUses = Math.max(0, freeWizardUsesRemaining - 1);
                const updateResponse = await authApi.updateProfile({
                    settings: { free_wizard_uses_remaining: nextUses },
                });
                if (updateResponse.data) {
                    await updateUser(updateResponse.data);
                }
            }
            setCreatedProgramId(programId || "created");
            setCreatedProgramIntro((programData as any).programIntro || null);
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
                    {!!createdProgramIntro?.sections?.length && (
                        <View style={styles.selectionInfoBox}>
                            <Ionicons name="school-outline" size={18} color={colors.accent} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.selectionInfoTitle}>{createdProgramIntro.title || "Program tanıtımı"}</Text>
                                {createdProgramIntro.sections.slice(0, 5).map((section: any) => (
                                    <View key={section.title} style={styles.introRow}>
                                        <Text style={styles.introTitle}>{section.title}</Text>
                                        <Text style={styles.introBody}>{section.body}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("ProgramList")}>
                        <Text style={styles.primaryText}>Kütüphaneye Git</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={returnToCoach}>
                        <Text style={styles.secondaryText}>Koç'a Dön</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        switch (step) {
            case -1:
                return null;
            case 0:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Seviyeni seç</Text>
                        <Text style={styles.bodyText}>Hacim ve efor mantığı seviyene göre kurulacak.</Text>
                        {LEVELS.map((item) => (
                            <OptionCard
                                key={item.key}
                                active={level === item.key}
                                title={item.label}
                                subtitle={item.key === "advanced" ? item.desc : `${item.desc} RIR ${item.rir}`}
                                onPress={() => setLevel(item.key)}
                                colors={colors}
                            />
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
                            <>
                                <TextInput
                                    value={painNote}
                                    onChangeText={setPainNote}
                                    placeholder="Örn: Sağ dizimde squat sırasında ağrı oluyor"
                                    placeholderTextColor={colors.textMuted}
                                    style={styles.input}
                                    multiline
                                />
                                <View style={styles.cautionBox}>
                                    <Ionicons name="medical-outline" size={18} color={colors.warning || colors.accent} />
                                    <Text style={styles.cautionText}>
                                        Bu tıbbi öneri değildir. Doktor/fizyoterapist kısıtlaması varsa onu önceliklendir. Koç yalnızca program yükünü daha temkinli ayarlar.
                                    </Text>
                                </View>
                                {injuryMode && painLimitedPatterns.length > 0 && (
                                    <View style={styles.cautionBox}>
                                        <Ionicons name="ban-outline" size={18} color={colors.warning || colors.accent} />
                                        <Text style={styles.cautionText}>
                                            Sakatlık notu algılandı. Eşleşen hareket/patternler programda kalır fakat sakatlık geçene kadar loglanamaz; belirsizse daha net bölge yaz.
                                        </Text>
                                    </View>
                                )}
                                {painLimitedPatterns.length > 0 && !injuryMode && (
                                    <>
                                        <Text style={styles.inlineLabel}>Eşleşen bölgeyi programa dahil edelim mi?</Text>
                                        <Text style={styles.bodyText}>
                                            Eşleşen paternler: {painLimitedPatterns.map((pattern) => PATTERN_LABELS[pattern]).join(", ")}
                                        </Text>
                                        <OptionCard
                                            active={includePainArea === "yes"}
                                            title="Evet, kontrollü dahil et"
                                            subtitle="Daha yüksek RIR ve düşük riskli set hedefiyle programda kalır."
                                            onPress={() => setIncludePainArea("yes")}
                                            colors={colors}
                                        />
                                        <OptionCard
                                            active={includePainArea === "no"}
                                            title="Hayır, şimdilik çıkar"
                                            subtitle="Eşleşen bölge bu program taslağından geçici olarak çıkarılır."
                                            onPress={() => setIncludePainArea("no")}
                                            colors={colors}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </View>
                );
            case 3:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Hedef ve ortam</Text>
                        <Text style={styles.bodyText}>Hedef program parametrelerini, süre ve ekipman bilgisi ise seçilecek hareketleri etkiler.</Text>
                        {GOALS.map((item) => (
                            <OptionCard key={item.key} active={goal === item.key} title={item.label} onPress={() => setGoal(item.key)} colors={colors} />
                        ))}
                        {goal === "strength" && (
                            <>
                                <Text style={styles.inlineLabel}>Güç odağı</Text>
                                {STRENGTH_FOCUS_OPTIONS.map((item) => (
                                    <OptionCard
                                        key={item.key}
                                        active={strengthFocus === item.key}
                                        title={item.label}
                                        subtitle={item.desc}
                                        onPress={() => setStrengthFocus(item.key)}
                                        colors={colors}
                                    />
                                ))}
                            </>
                        )}
                        <Text style={styles.inlineLabel}>Session süresi</Text>
                        {SESSION_DURATIONS.map((item) => (
                            <OptionCard
                                key={item.key}
                                active={sessionDuration === item.key}
                                title={item.label}
                                subtitle={item.desc}
                                onPress={() => setSessionDuration(item.key)}
                                colors={colors}
                            />
                        ))}
                        <Text style={styles.inlineLabel}>Ekipman erişimi sorunu yaşıyor musun?</Text>
                        <OptionCard
                            active={hasEquipmentLimit === "no"}
                            title="Hayır, tam erişimim var"
                            subtitle="Tam salon ekipmanı varsayılır."
                            onPress={() => {
                                setHasEquipmentLimit("no");
                                setEquipmentLimitNote("");
                            }}
                            colors={colors}
                        />
                        <OptionCard
                            active={hasEquipmentLimit === "yes"}
                            title="Evet, eksiklerim var"
                            subtitle="Eksik ekipmanları yazarsan öneriler buna göre daralır."
                            onPress={() => setHasEquipmentLimit("yes")}
                            colors={colors}
                        />
                        {hasEquipmentLimit === "yes" && (
                            <>
                                <Text style={styles.helperText}>
                                    Sadece eksik ekipmanı veya mecbur kaldığın ekipmanı yaz. Koç bu bilgiye göre daha stabil ve uygulanabilir hareketleri öne alır.
                                </Text>
                                <View style={styles.quickChipRow}>
                                    {EQUIPMENT_LIMIT_CHIPS.map((note) => (
                                        <TouchableOpacity key={note} style={styles.quickChip} onPress={() => appendEquipmentNote(note)} activeOpacity={0.82}>
                                            <Text style={styles.quickChipText}>{note}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {machineTypeOptions.length > 0 && (
                                    <>
                                        <Text style={styles.helperText}>Spesifik makine eksikliği varsa seçebilirsin:</Text>
                                        <View style={styles.quickChipRow}>
                                            {machineTypeOptions.slice(0, 12).map((type) => (
                                                <TouchableOpacity key={type} style={styles.quickChip} onPress={() => appendEquipmentNote(type.replace(/_/g, " ") + " yok")} activeOpacity={0.82}>
                                                    <Text style={styles.quickChipText}>{type.replace(/_/g, " ")} yok</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                                <TextInput
                                value={equipmentLimitNote}
                                onChangeText={setEquipmentLimitNote}
                                placeholder="Örn: Smith machine yok, cable yok, sadece dumbbell var"
                                placeholderTextColor={colors.textMuted}
                                style={[styles.input, styles.textArea]}
                                multiline
                            />
                            </>
                        )}
                    </View>
                );
            case 4:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Öncelik ve kaçınmalar</Text>
                        <Text style={styles.bodyText}>Basit modda tek ana eksik bölge seçebilirsin. Detaylı modda kaslara sırayla dokunup program öncelik sırasını kurarsın.</Text>
                        <View style={styles.segmentRow}>
                            <TouchableOpacity style={[styles.segmentBtn, priorityMode === "simple" && styles.segmentBtnActive]} onPress={() => setPriorityMode("simple")}>
                                <Text style={[styles.segmentText, priorityMode === "simple" && styles.segmentTextActive]}>Basit öncelik</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.segmentBtn, priorityMode === "ordered" && styles.segmentBtnActive]} onPress={() => setPriorityMode("ordered")}>
                                <Text style={[styles.segmentText, priorityMode === "ordered" && styles.segmentTextActive]}>Öncelik sırası</Text>
                            </TouchableOpacity>
                        </View>
                        {priorityMode === "simple" ? (
                            <>
                                <Text style={styles.inlineLabel}>Eksik bölge</Text>
                                <View style={styles.priorityGrid}>
                                    {PRIORITY_GROUPS.map((group) => (
                                        <TouchableOpacity
                                            key={group.key}
                                            style={[styles.priorityChip, priorityGroup === group.key && styles.priorityChipActive]}
                                            onPress={() => {
                                                if (priorityGroup === group.key) {
                                                    setPriorityGroup(null);
                                                    setPriority(null);
                                                    return;
                                                }
                                                setPriorityGroup(group.key);
                                                setPriority(group.patterns[0]);
                                            }}
                                        >
                                            <Text style={[styles.priorityText, priorityGroup === group.key && styles.priorityTextActive]}>{group.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {selectedPriorityGroup && selectedPriorityGroup.patterns.length > 1 && (
                                    <>
                                        <Text style={styles.inlineLabel}>Alt odak</Text>
                                        <View style={styles.priorityGrid}>
                                            {selectedPriorityGroup.patterns.map((pattern) => (
                                                <TouchableOpacity
                                                    key={pattern}
                                                    style={[styles.priorityChip, priority === pattern && styles.priorityChipActive]}
                                                    onPress={() => setPriority(pattern)}
                                                >
                                                    <Text style={[styles.priorityText, priority === pattern && styles.priorityTextActive]}>
                                                        {PRIORITIES.find((item) => item.key === pattern)?.label || PATTERN_LABELS[pattern]}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                            </>
                        ) : (
                            <>
                                <Text style={styles.inlineLabel}>Kas öncelik sırası</Text>
                                <Text style={styles.bodyText}>Dokunduğun sıra korunur. Tekrar dokunursan listeden çıkar.</Text>
                                <TouchableOpacity
                                    style={[styles.guidanceToggle, !priorityGuidanceEnabled && styles.guidanceToggleOff]}
                                    onPress={() => setPriorityGuidanceEnabled((current) => !current)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name={priorityGuidanceEnabled ? "lock-closed-outline" : "lock-open-outline"} size={16} color={colors.accent} />
                                    <Text style={styles.guidanceToggleText}>{priorityGuidanceEnabled ? "Öneri kilitleri açık" : "Öneri kilitleri kapalı"}</Text>
                                </TouchableOpacity>
                                {priorityOrder.length > 0 && (
                                    <View style={styles.orderPreview}>
                                        {priorityOrder.map((pattern, index) => (
                                            <View key={pattern} style={styles.orderPill}>
                                                <Text style={styles.orderPillText}>{index + 1}. {PATTERN_LABELS[pattern]}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {hasUpperBackPriorityOverlap && (
                                    <View style={styles.cautionBox}>
                                        <Ionicons name="alert-circle-outline" size={18} color="#F5A524" />
                                        <Text style={styles.cautionText}>
                                            Arka omuz ve trapez zaten üst sırt paternine destek olur. Üst sırtı ayrıca seçersen koç bunu tek birleşik üst sırt odağı olarak düşünebilir; arka omuz/trapezi ayrı ayrı özellikle büyütmek istiyorsan üst sırtı listeden çıkar.
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.priorityGrid}>
                                    {PRIORITIES.map((item) => {
                                        const selectedIndex = priorityOrder.indexOf(item.key);
                                        const isSelected = selectedIndex >= 0;
                                        const locked = isPriorityChoiceLocked(item.key, priorityOrder, priorityGuidanceEnabled);
                                        return (
                                            <TouchableOpacity
                                                key={item.key}
                                                disabled={locked}
                                                style={[styles.priorityChip, isSelected && styles.priorityChipActive, locked && styles.priorityChipDisabled]}
                                                onPress={() => {
                                                    setPriorityOrder((current) => applyPrioritySelectionRules(current, item.key, priorityGuidanceEnabled));
                                                }}
                                            >
                                                <Text style={[styles.priorityText, isSelected && styles.priorityTextActive, locked && styles.priorityTextDisabled]}>
                                                    {isSelected ? `${selectedIndex + 1}. ` : ""}{item.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        )}
                        <TextInput value={avoidNote} onChangeText={setAvoidNote} placeholder="Kaçındığın/sevmediğin hareket varsa yaz" placeholderTextColor={colors.textMuted} style={styles.input} />
                        <Text style={styles.helperText}>
                            Örn: Pec deck yazarsan göğüs önerilerinden çıkarılır; koç aynı patern için diğer uygun hareketleri öne alır.
                        </Text>
                        {avoidedExerciseTokens.length > 0 && (
                            <Text style={styles.helperText}>
                                Kaçınma filtresi aktif: {avoidedExerciseTokens.slice(0, 4).join(", ")}
                                {avoidedExerciseTokens.length > 4 ? "..." : ""}
                            </Text>
                        )}
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
                        <View style={styles.selectionInfoBox}>
                            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.selectionInfoTitle}>Oneri sirasi nasil kuruluyor?</Text>
                                <Text style={styles.selectionInfoText}>Daha stabil, seviyene uygun ve notlarina uyan hareketler once gelir. Istersen her paternde manuel secim yapabilirsin.</Text>
                                <View style={styles.selectionReasonRow}>
                                    {exerciseSelectionReasons.map((reason) => (
                                        <Text key={reason} style={styles.selectionReasonChip}>{reason}</Text>
                                    ))}
                                </View>
                            </View>
                        </View>
                        {uniquePatterns.map((pattern) => {
                            const availableExercises = getAvailableExercises(pattern, avoidNote, [], exerciseSelectionOptions);
                            const expanded = !!expandedExercisePatterns[pattern];
                            const selected = resolveExercise(pattern);
                            const compactExercises = availableExercises.slice(0, 5);
                            const visibleExercises = expanded
                                ? availableExercises
                                : selected && availableExercises.includes(selected) && !compactExercises.includes(selected)
                                    ? [...compactExercises, selected]
                                    : compactExercises;
                            const hasMoreExercises = availableExercises.length > visibleExercises.length;
                            return (
                                <View key={pattern} style={styles.exercisePicker}>
                                    <View style={styles.patternHeader}>
                                        <Text style={styles.patternLabel}>{PATTERN_LABELS[pattern]}</Text>
                                        <Text style={styles.patternMeta}>
                                            {expanded ? `${availableExercises.length} secenek` : `${visibleExercises.length}/${availableExercises.length} secenek`}
                                        </Text>
                                    </View>
                                    {availableExercises.length === 0 && (
                                        <View style={styles.cautionBox}>
                                            <Ionicons name="alert-circle-outline" size={18} color={colors.warning || colors.accent} />
                                            <Text style={styles.cautionText}>
                                                Bu filtrelerle uygun hareket kalmadı. Ekipman veya kaçınma notunu yumuşat.
                                            </Text>
                                        </View>
                                    )}
                                    {visibleExercises.map((exercise) => {
                                        const index = Math.max(0, availableExercises.indexOf(exercise));
                                        const libraryItem = libraryByName.get(exercise);
                                        const active = selected === exercise;
                                        return (
                                        <TouchableOpacity
                                            key={exercise}
                                            style={[styles.exerciseOption, active && styles.exerciseOptionActive]}
                                            onPress={() => setSelectedExercises((prev) => ({ ...prev, [pattern]: exercise }))}
                                        >
                                            <View style={styles.exerciseOptionCopy}>
                                                <Text style={[styles.exerciseOptionText, active && styles.exerciseOptionTextActive]}>{exercise}</Text>
                                                <Text style={styles.exerciseOptionMeta}>#{index + 1} öneri sırası</Text>
                                            </View>
                                            {libraryItem && (
                                                <TouchableOpacity
                                                    style={styles.exerciseInfoBtn}
                                                    onPress={() => setExerciseInfo({ pattern, item: libraryItem, rank: index + 1 })}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="information-circle-outline" size={18} color={active ? colors.accent : colors.textMuted} />
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                        );
                                    })}
                                    {(hasMoreExercises || expanded) && (
                                        <TouchableOpacity
                                            style={styles.exerciseShowAllBtn}
                                            onPress={() => setExpandedExercisePatterns((prev) => ({ ...prev, [pattern]: !expanded }))}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={styles.exerciseShowAllText}>
                                                {expanded ? "Kapat" : `Tümünü gör (${availableExercises.length})`}
                                            </Text>
                                            <Ionicons
                                                name={expanded ? "chevron-up" : "chevron-down"}
                                                size={16}
                                                color={colors.accent}
                                            />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                );
            default:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Özet ve oluştur</Text>
                        <Text style={styles.bodyText}>
                            {programName} programı haftada {frequency} antrenman günü ve dinlenme günleriyle oluşturulacak. Ana RIR hedefi: {targetRir(level)}.
                        </Text>
                        {goal === "fat_loss" && (
                            <Text style={styles.bodyText}>Yağ kaybına destek hedefinde tekrar aralığı minimum 8-12 olur; zaten 8-12 olan paternler 12-15'e çıkarılır.</Text>
                        )}
                        {hasPain === "yes" && (
                            <Text style={styles.bodyText}>
                                Ağrı/sakatlık notu nedeniyle eşleşen paternlerde koç daha temkinli hedefler kullanır.
                            </Text>
                        )}
                        {workoutDays.map((day) => (
                            <View key={day.label} style={styles.summaryDay}>
                                <Text style={styles.summaryDayTitle}>{day.label}</Text>
                                <Text style={styles.summaryDayText}>
                                    {day.isRestDay ? "Dinlenme günü" : day.patterns.map((pattern) => resolveExercise(pattern)).join(", ")}
                                </Text>
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
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
            <View style={styles.topBar}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack}>
                    <Ionicons name={step === 0 || createdProgramId ? "close" : "chevron-back"} size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${((createdProgramId ? 8 : step + 1) / 8) * 100}%` }]} />
                </View>
                <Text style={styles.stepText}>{createdProgramId ? "8/8" : `${step + 1}/8`}</Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                onScrollBeginDrag={Keyboard.dismiss}
            >
                <View style={styles.hero}>
                    <Text style={styles.eyebrow}>AKILLI KOÇ WIZARD</Text>
                    <Text style={styles.title}>Programı birlikte kuralım</Text>
                    <Text style={styles.subtitle}>
                        Rule engine ilk taslağı oluşturur; kararları sen onaylarsın.
                        {hasProAccess ? ` Kalan Premium wizard hakkı: ${proWizardUsesRemaining}/15.` : ` Ücretsiz kalan wizard hakkı: ${freeWizardUsesRemaining}.`}
                    </Text>
                </View>
                {wizardUsesRemaining <= 0 ? (
                    <View style={styles.card}>
                        <Ionicons name="lock-closed-outline" size={24} color={colors.accent} />
                        <Text style={styles.cardTitle}>Wizard hakkın doldu</Text>
                        <Text style={styles.bodyText}>
                            {hasProAccess
                                ? "Premium wizard limiti 15 program. Mevcut programlarını düzenleyerek devam edebilirsin."
                                : "Ücretsiz iki deneme hakkı tamamlanmış. Premium deneme veya abonelik aktif olduğunda 15 akıllı program hakkın olur."}
                        </Text>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={returnToCoach}>
                            <Text style={styles.secondaryText}>Koç'a Dön</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                {notice && !createdProgramId && (
                    <View style={styles.notice}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                        <Text style={styles.noticeText}>{notice}</Text>
                    </View>
                )}
                {renderStep()}
                    </>
                )}
            </ScrollView>

            {!createdProgramId && step < 7 && wizardUsesRemaining > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.primaryBtn} onPress={goNext}>
                        <Text style={styles.primaryText}>Devam Et</Text>
                    </TouchableOpacity>
                </View>
            )}
            <Modal visible={!!exerciseInfo} transparent animationType="fade" onRequestClose={() => setExerciseInfo(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.exerciseInfoModal}>
                        {exerciseInfo && exerciseInfoMeta && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalEyebrow}>#{exerciseInfo.rank} onerilen secenek</Text>
                                        <Text style={styles.modalTitle}>{exerciseInfo.item.name}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.modalClose} onPress={() => setExerciseInfo(null)} activeOpacity={0.8}>
                                        <Ionicons name="close" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.modalDesc}>
                                    {PATTERN_LABELS[exerciseInfo.pattern]} icin onerilir. Sira; seviye, stabilite, risk, ekipman ve notlarina gore belirlenir.
                                </Text>
                                <View style={styles.modalChipRow}>
                                    <Text style={styles.modalChip}>{stabilityLabel(exerciseInfoMeta.stability)}</Text>
                                    <Text style={styles.modalChip}>{skillDemandLabel(exerciseInfoMeta.skillDemand)}</Text>
                                    <Text style={styles.modalChip}>{riskLevelLabel(exerciseInfoMeta.riskLevel)}</Text>
                                </View>
                                <Text style={styles.modalSectionTitle}>Koç notu</Text>
                                <Text style={styles.modalDesc}>{exerciseInfo.item.coachNotes}</Text>
                                <Text style={styles.modalSectionTitle}>Temel ipuçları</Text>
                                {exerciseInfo.item.instructions.slice(0, 3).map((instruction) => (
                                    <View key={instruction} style={styles.modalBullet}>
                                        <View style={styles.modalBulletDot} />
                                        <Text style={styles.modalBulletText}>{instruction}</Text>
                                    </View>
                                ))}
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
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
    textArea: {
        minHeight: 84,
        textAlignVertical: "top",
    },
    quickChipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    quickChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    quickChipText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    helperText: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        lineHeight: 18,
        marginTop: spacing.xs,
    },
    inlineLabel: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        marginTop: spacing.xs,
    },
    durationGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    durationChip: {
        minHeight: 40,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
    },
    durationChipActive: {
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    durationText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    durationTextActive: {
        color: colors.accent,
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
    priorityChipDisabled: {
        opacity: 0.36,
    },
    priorityText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    priorityTextActive: {
        color: colors.accent,
    },
    priorityTextDisabled: {
        color: colors.textMuted,
    },
    guidanceToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        alignSelf: "flex-start",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
    },
    guidanceToggleOff: {
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    guidanceToggleText: {
        color: colors.text,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    segmentRow: {
        flexDirection: "row",
        gap: spacing.sm,
        padding: 4,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    segmentBtn: {
        flex: 1,
        minHeight: 42,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.sm,
    },
    segmentBtnActive: {
        backgroundColor: colors.accent,
    },
    segmentText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    segmentTextActive: {
        color: colors.background,
    },
    orderPreview: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    orderPill: {
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
    },
    orderPillText: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    cautionBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    cautionText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    selectionInfoBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    selectionInfoTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    selectionInfoText: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 18,
        marginTop: 2,
    },
    introRow: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    introTitle: {
        color: colors.text,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
    },
    introBody: {
        color: colors.textSecondary,
        fontSize: fontSize.xs,
        lineHeight: 18,
        marginTop: 2,
    },
    selectionReasonRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    selectionReasonChip: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
    },
    exercisePicker: {
        gap: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    patternHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
    },
    patternLabel: {
        color: colors.text,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    patternMeta: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    exerciseOption: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
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
    exerciseOptionCopy: {
        flex: 1,
        gap: 2,
    },
    exerciseOptionText: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
    },
    exerciseOptionTextActive: {
        color: colors.accent,
    },
    exerciseOptionMeta: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
    },
    exerciseShowAllBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.accent + "55",
        backgroundColor: colors.accentMuted,
    },
    exerciseShowAllText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    exerciseInfoBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.56)",
        justifyContent: "center",
        padding: spacing.xl,
    },
    exerciseInfoModal: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        gap: spacing.md,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
    },
    modalEyebrow: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    modalTitle: {
        color: colors.text,
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        marginTop: 2,
    },
    modalClose: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
    },
    modalDesc: {
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
    modalChipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    modalChip: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.bold,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
    },
    modalSectionTitle: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    modalBullet: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
    },
    modalBulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.accent,
        marginTop: 7,
    },
    modalBulletText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: fontSize.sm,
        lineHeight: 20,
    },
});
