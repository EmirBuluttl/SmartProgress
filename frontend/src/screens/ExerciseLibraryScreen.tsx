import React from "react";
import { Animated, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { EXERCISE_LIBRARY, type ExerciseLibraryItem } from "../data/exerciseLibrary";
import { getExerciseMetadata, riskLevelLabel, skillDemandLabel, stabilityLabel } from "../data/exerciseMetadata";
import { displayExerciseTarget, displayMuscleGroup, MUSCLE_GROUPS, patternPurpose, relatedPatternsForExercise } from "../data/exerciseTaxonomy";
import { useTheme } from "../hooks/ThemeContext";
import { COACH_PATTERN_LABELS, type CoachPatternKey } from "../services/coachRuleEngine";
import AnimatedPressable from "../components/AnimatedPressable";
import PremiumModalSurface from "../components/PremiumModalSurface";

const FILTERS = [
    { key: "all", label: "Tümü" },
    { key: "horizontal_adduction", label: "Göğüs" },
    { key: "upper_chest", label: "Üst göğüs" },
    { key: "shoulder_abduction", label: "Yan omuz" },
    { key: "shoulder_flexion", label: "Ön omuz" },
    { key: "rear_delt", label: "Arka omuz" },
    { key: "rotator_cuff", label: "Rotator cuff" },
    { key: "shoulder_adduction", label: "Alt kanat" },
    { key: "shoulder_extension", label: "Üst kanat" },
    { key: "upper_back", label: "Üst sırt" },
    { key: "trapezius", label: "Trapez" },
    { key: "elbow_flexion", label: "Biceps" },
    { key: "elbow_extension", label: "Triceps" },
    { key: "leg_press", label: "Vastuslar" },
    { key: "knee_extension", label: "Quadriceps" },
    { key: "hip_hinge", label: "Hinge" },
    { key: "hip_abduction", label: "Glute" },
    { key: "knee_flexion", label: "Hamstring" },
    { key: "spinal_flexion", label: "Spine flexion" },
    { key: "spinal_extension", label: "Spine extension" },
    { key: "spinal_rotation", label: "Spine rotation" },
    { key: "calf_raise", label: "Calve" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];
type LibraryRegion = "all" | "upper" | "lower" | "core";
type DifficultyFilter = "all" | ExerciseLibraryItem["difficulty"];

const REGION_FILTERS: { key: LibraryRegion; label: string; patterns: string[] }[] = [
    { key: "all", label: "Tümü", patterns: [] },
    {
        key: "upper",
        label: "Upper",
        patterns: MUSCLE_GROUPS.filter((group) => group.region === "upper").flatMap((group) => group.patterns),
    },
    {
        key: "lower",
        label: "Lower",
        patterns: MUSCLE_GROUPS.filter((group) => group.region === "lower").flatMap((group) => group.patterns),
    },
    {
        key: "core",
        label: "Core",
        patterns: MUSCLE_GROUPS.filter((group) => group.region === "core").flatMap((group) => group.patterns),
    },
];

const EQUIPMENT_LABELS: Record<string, string> = {
    machine: "Machine",
    smith: "Smith Machine",
    cable: "Cable",
    barbell: "Barbell",
    dumbbell: "Dumbbell",
    bodyweight: "BW/Calisthenics",
    bench: "Bench",
    leg_press: "Leg Press",
};

const EQUIPMENT_FILTERS = Object.entries(EQUIPMENT_LABELS)
    .filter(([key]) => key !== "bench" && key !== "leg_press")
    .map(([key, label]) => ({ key, label }));
const DIFFICULTY_FILTERS: { key: DifficultyFilter; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "beginner", label: "Başlangıç" },
    { key: "intermediate", label: "Orta" },
    { key: "advanced", label: "İleri" },
];

function equipmentLabel(value: string) {
    return EQUIPMENT_LABELS[value] || value;
}

function normalizeText(value: unknown) {
    return String(value || "").toLocaleLowerCase("tr-TR").trim();
}

function difficultyLabel(value: ExerciseLibraryItem["difficulty"]) {
    if (value === "beginner") return "Başlangıç";
    if (value === "advanced") return "İleri";
    return "Orta";
}

function guidePoints(exercise: ExerciseLibraryItem) {
    const points: string[] = [];
    const metadata = getExerciseMetadata(exercise);
    if (exercise.beginnerFriendly) points.push("Formu ogrenmek veya hareket hissini oturtmak icin iyi bir secimdir.");
    if (exercise.tags.includes("stable") || exercise.tags.includes("guided")) points.push("Stabil oldugu icin kilo/tekrar takibi daha tutarli olur.");
    if (exercise.tags.includes("compound")) points.push("Ana hareket olarak kullanilabilir; toparlanma ve teknik standardi takip edilmeli.");
    if (exercise.tags.includes("isolation")) points.push("Eksik bolgeyi tamamlamak veya hedef kas hissini artirmak icin uygundur.");
    if (exercise.tags.includes("strength")) points.push("Guc artisi takibinde anlamli olabilir; ego lift yerine tekrar edilebilir form onceliklidir.");
    if (metadata.goalFit.includes("fatigue_management")) points.push("Yorgunluk yonetimi ve teknik tutarlilik icin iyi bir secenektir.");
    if (metadata.goalFit.includes("rehab")) points.push("Omuz sagligi veya kontrollu kapasite calismasi icin dusuk yukle kullanilabilir.");
    if (exercise.equipment.includes("bodyweight")) points.push("BW/Calisthenics hareketlerinde gerekirse external load/bodyweight ayrimiyla loglamak daha dogru olur.");
    return points.length > 0 ? points : ["Programdaki hedef kas paternine uyuyorsa kontrollu sekilde kullanilabilir."];
}

function cautionPoints(exercise: ExerciseLibraryItem) {
    const labels: Record<string, string> = {
        shoulder_pain_sensitive: "Omuz agrisi veya rotator cuff hassasiyeti varsa dikkatli kullan.",
        elbow_pain_sensitive: "Dirsek hassasiyeti varsa yuk ve tutus acisini temkinli sec.",
        wrist_pain_sensitive: "Bilek hassasiyeti varsa tutus ve agirlik secimini kontrol et.",
        knee_pain_sensitive: "Diz agrisi varsa hareket araligi ve tempo kontrollu olmali.",
        low_back_sensitive: "Bel hassasiyeti varsa govde pozisyonu ve yorgunluk birikimi takip edilmeli.",
        hip_pain_sensitive: "Kalca hassasiyeti varsa agri olusturan araliktan kac.",
        hamstring_sensitive: "Hamstring hassasiyeti varsa gerilimi kademeli arttir.",
        ankle_pain_sensitive: "Ayak bilegi hassasiyeti varsa kontrollu aralik kullan.",
        neck_pain_sensitive: "Boyun hassasiyeti varsa trapez ve shrug varyasyonlarında yükü temkinli seç.",
    };
    const cautions = exercise.contraindicationTags.map((tag) => labels[tag]).filter(Boolean);
    if (exercise.difficulty === "advanced") cautions.push("Yeni baslayanlar icin ilk tercih olmamali; teknik standardi yuksek ister.");
    return cautions.length > 0 ? cautions : ["Bilinen agri yoksa normal program akisi icinde takip edilebilir."];
}

function trackingPoints(exercise: ExerciseLibraryItem) {
    const points = [
        "Isinma setlerini progress hesabina dahil etme; calisma setlerini tutarli logla.",
        "Ayni hareketi farkli isimlerle yazmak yerine kutuphaneden secmek analiz kalitesini arttirir.",
    ];
    if (exercise.tags.includes("cable") || exercise.equipment.includes("machine")) {
        points.push("Makine/kablo istasyonu degisirse kilo karsilastirmasinda temkinli ol.");
    }
    if (exercise.equipment.includes("bodyweight")) {
        points.push("BW veya external load degisirse bunu logda net ayir.");
    }
    return points;
}

export default function ExerciseLibraryScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [filter, setFilter] = React.useState<FilterKey>("all");
    const [region, setRegion] = React.useState<LibraryRegion>("all");
    const [difficulty, setDifficulty] = React.useState<DifficultyFilter>("all");
    const [equipmentFilters, setEquipmentFilters] = React.useState<string[]>([]);
    const [query, setQuery] = React.useState("");
    const [filterModalVisible, setFilterModalVisible] = React.useState(false);
    const [guideModalVisible, setGuideModalVisible] = React.useState(false);
    const [selected, setSelected] = React.useState<ExerciseLibraryItem | null>(null);
    const headerAnim = React.useRef(new Animated.Value(0)).current;
    const listAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        headerAnim.setValue(0);
        listAnim.setValue(0);
        Animated.stagger(90, [
            Animated.spring(headerAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 22,
                bounciness: 5,
            }),
            Animated.spring(listAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 22,
                bounciness: 4,
            }),
        ]).start();
    }, [headerAnim, listAnim]);

    const exercises = React.useMemo(() => {
        const regionPatterns = REGION_FILTERS.find((item) => item.key === region)?.patterns || [];
        const search = normalizeText(query);
        const filtered = EXERCISE_LIBRARY.filter((exercise) => {
            if (region !== "all" && !regionPatterns.includes(exercise.pattern)) return false;
            if (filter !== "all") {
                const matchesPattern = exercise.pattern === filter || (filter === "knee_extension" && exercise.pattern === "leg_press");
                if (!matchesPattern) return false;
            }
            if (difficulty !== "all" && exercise.difficulty !== difficulty) return false;
            if (equipmentFilters.length > 0 && !equipmentFilters.some((equipment) => exercise.equipment.includes(equipment as any))) return false;
            if (search) {
                const haystack = [
                    exercise.name,
                    ...exercise.aliases,
                    ...exercise.primaryMuscles,
                    ...exercise.secondaryMuscles,
                    COACH_PATTERN_LABELS[exercise.pattern as CoachPatternKey] || exercise.pattern,
                ].map(normalizeText).join(" ");
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
        return [...filtered].sort((a, b) => Number(b.beginnerFriendly) - Number(a.beginnerFriendly));
    }, [difficulty, equipmentFilters, filter, query, region]);

    const activeFilterCount = Number(region !== "all") +
        Number(filter !== "all") +
        Number(difficulty !== "all") +
        equipmentFilters.length;

    const selectedGroup = React.useMemo(
        () => MUSCLE_GROUPS.find((group) => group.patterns.includes(filter)),
        [filter],
    );

    const firstVisiblePattern = (patterns: string[]) => {
        const available = patterns.find((pattern) => pattern !== "leg_press" || difficulty === "advanced");
        return (available || patterns[0] || "all") as FilterKey;
    };

    React.useEffect(() => {
        if (difficulty !== "advanced" && filter === "leg_press") {
            setFilter("all");
        }
    }, [difficulty, filter]);

    const toggleEquipment = (key: string) => {
        setEquipmentFilters((current) =>
            current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
        );
    };

    const headerMotionStyle = {
        opacity: headerAnim,
        transform: [
            {
                translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                }),
            },
        ],
    };

    const listMotionStyle = {
        opacity: listAnim,
        transform: [
            {
                translateY: listAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                }),
            },
        ],
    };

    return (
        <>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Animated.View style={[styles.headerBlock, headerMotionStyle]}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.eyebrow}>REHBER</Text>
                            <Text style={styles.title}>Egzersiz Kütüphanesi</Text>
                            <Text style={styles.subtitle}>
                                Hareketler SmartProgress paternlerine göre sınıflanır. Wizard da aynı kütüphaneden öneri üretir.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.searchPanel}>
                        <View style={styles.searchBox}>
                            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Hareket, kas veya ekipman ara"
                                placeholderTextColor={colors.textMuted}
                                style={styles.searchInput}
                            />
                        </View>
                        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModalVisible(true)} activeOpacity={0.84}>
                            <Ionicons name="options-outline" size={18} color={colors.accent} />
                            <Text style={styles.filterBtnText}>Filtrele{activeFilterCount ? ` (${activeFilterCount})` : ""}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.guideBtn} onPress={() => setGuideModalVisible(true)} activeOpacity={0.84}>
                            <Ionicons name="body-outline" size={18} color={colors.accent} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.resultCount}>{exercises.length} hareket bulundu</Text>
                </Animated.View>

                <Animated.View style={[styles.list, listMotionStyle]}>
                    {exercises.map((exercise) => (
                        <AnimatedPressable
                            key={exercise.id}
                            style={styles.cardPressable}
                            pressedScale={0.985}
                            onPress={() => setSelected(exercise)}
                        >
                            <View style={styles.card}>
                                <View style={styles.cardTop}>
                                    <View style={styles.iconBox}>
                                        <Ionicons name="barbell-outline" size={19} color={colors.accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                                        <Text style={styles.exerciseMeta}>
                                            {displayExerciseTarget(exercise)} · {difficultyLabel(exercise.difficulty)}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                                </View>
                                <View style={styles.badgeRow}>
                                    {exercise.beginnerFriendly && <Text style={styles.badge}>Başlangıç dostu</Text>}
                                    {exercise.equipment.slice(0, 2).map((equipment) => (
                                        <Text key={equipment} style={styles.badge}>{equipmentLabel(equipment)}</Text>
                                    ))}
                                </View>
                                <Text style={styles.cardText} numberOfLines={2}>{exercise.coachNotes}</Text>
                            </View>
                        </AnimatedPressable>
                    ))}
                </Animated.View>
            </ScrollView>

            <PremiumModalSurface visible={!!selected} onDismiss={() => setSelected(null)} containerStyle={styles.modalCard}>
                        {selected && (
                            <>
                                <View style={styles.modalHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalTitle}>{selected.name}</Text>
                                        <Text style={styles.modalSubtitle}>
                                            {displayExerciseTarget(selected)} · {difficultyLabel(selected.difficulty)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity style={styles.modalClose} onPress={() => setSelected(null)}>
                                        <Ionicons name="close" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                    <View style={styles.quickInfoGrid}>
                                        <InfoPill label="Seviye" value={difficultyLabel(selected.difficulty)} styles={styles} />
                                        <InfoPill label="Ekipman" value={selected.equipment.slice(0, 2).map(equipmentLabel).join(", ")} styles={styles} />
                                        <InfoPill label="Bölge" value={displayMuscleGroup(selected)} styles={styles} />
                                        <InfoPill label="Stabilite" value={stabilityLabel(getExerciseMetadata(selected).stability)} styles={styles} />
                                        <InfoPill label="Teknik" value={skillDemandLabel(getExerciseMetadata(selected).skillDemand)} styles={styles} />
                                        <InfoPill label="Risk" value={riskLevelLabel(getExerciseMetadata(selected).riskLevel)} styles={styles} />
                                    </View>
                                    <View style={styles.patternPanel}>
                                        <Text style={styles.patternTitle}>
                                            {COACH_PATTERN_LABELS[selected.pattern as CoachPatternKey] || selected.pattern}
                                        </Text>
                                        <Text style={styles.patternText}>{patternPurpose(selected.pattern)}</Text>
                                        {relatedPatternsForExercise(selected).length > 0 && (
                                            <Text style={styles.patternRelated}>
                                                Yakın paternler: {relatedPatternsForExercise(selected).map((pattern) => COACH_PATTERN_LABELS[pattern as CoachPatternKey] || pattern).join(", ")}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.mediaPreview}>
                                        <View style={styles.mediaIcon}>
                                            <Ionicons name="play-circle-outline" size={28} color={colors.accent} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.mediaTitle}>Video / GIF rehberi</Text>
                                            <Text style={styles.mediaText}>
                                                Telifli görseller doğrudan gömülmez. Kendi çizimimiz veya lisanslı kaynak eklenince burada oynatılacak.
                                            </Text>
                                            {!!selected.mediaSourceUrl && (
                                                <TouchableOpacity onPress={() => Linking.openURL(selected.mediaSourceUrl!)} activeOpacity={0.8}>
                                                    <Text style={styles.mediaLink}>Kaynağı aç{selected.mediaCredit ? ` · ${selected.mediaCredit}` : ""}</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <DetailBlock title="Hedef kaslar" items={[...selected.primaryMuscles, ...selected.secondaryMuscles]} styles={styles} />
                                    <DetailBlock title="Ne zaman secilmeli" items={guidePoints(selected)} styles={styles} />
                                    <DetailBlock title="Nasıl yapılır" items={selected.instructions} styles={styles} />
                                    <DetailBlock title="Sık hatalar" items={selected.commonMistakes} styles={styles} warning />
                                    <DetailBlock title="Kim dikkat etmeli" items={cautionPoints(selected)} styles={styles} warning />
                                    <DetailBlock title="Takip notlari" items={trackingPoints(selected)} styles={styles} />
                                    <View style={styles.noteBox}>
                                        <Ionicons name="bulb-outline" size={18} color={colors.accent} />
                                        <Text style={styles.noteText}>{selected.coachNotes}</Text>
                                    </View>
                                    {selected.aliases.length > 0 && (
                                        <Text style={styles.aliasText}>Eşleşmeler: {selected.aliases.slice(0, 5).join(", ")}</Text>
                                    )}
                                </ScrollView>
                            </>
                        )}
            </PremiumModalSurface>

            <PremiumModalSurface visible={guideModalVisible} onDismiss={() => setGuideModalVisible(false)} containerStyle={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Kas ve patern rehberi</Text>
                                <Text style={styles.modalSubtitle}>
                                    Bir karta basınca ilgili patern filtrelenir. Aktif karta tekrar basarsan filtre kapanır.
                                </Text>
                            </View>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setGuideModalVisible(false)}>
                                <Ionicons name="close" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            <View style={styles.groupGrid}>
                                {MUSCLE_GROUPS.map((group) => {
                                    const isActive = selectedGroup?.key === group.key;
                                    return (
                                        <TouchableOpacity
                                            key={group.key}
                                            style={[styles.groupCard, isActive && styles.groupCardActive]}
                                            activeOpacity={0.84}
                                            onPress={() => {
                                                if (isActive) {
                                                    setRegion("all");
                                                    setFilter("all");
                                                    return;
                                                }
                                                setRegion(group.region);
                                        setFilter(firstVisiblePattern(group.patterns));
                                                setGuideModalVisible(false);
                                            }}
                                        >
                                            <Text style={[styles.groupTitle, isActive && styles.groupTitleActive]}>{group.beginnerLabel}</Text>
                                            <Text style={styles.groupText}>{group.info}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
            </PremiumModalSurface>

            <PremiumModalSurface visible={filterModalVisible} onDismiss={() => setFilterModalVisible(false)} containerStyle={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Filtrele</Text>
                                <Text style={styles.modalSubtitle}>Önce ana bölgeyi, sonra kas/patern ve ekipmanı seç.</Text>
                            </View>
                            <TouchableOpacity style={styles.modalClose} onPress={() => setFilterModalVisible(false)}>
                                <Ionicons name="close" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            <FilterGroup title="Ana bölge" styles={styles}>
                                {REGION_FILTERS.map((item) => (
                                    <FilterChip key={item.key} label={item.label} active={region === item.key} onPress={() => setRegion(item.key)} styles={styles} />
                                ))}
                            </FilterGroup>
                            <FilterGroup title="Kas / patern" styles={styles}>
                                {FILTERS.filter((item) => {
                                    const regionPatterns = REGION_FILTERS.find((regionItem) => regionItem.key === region)?.patterns || [];
                                    if (item.key === "leg_press" && difficulty !== "advanced") return false;
                                    return region === "all" || item.key === "all" || regionPatterns.includes(item.key);
                                }).map((item) => (
                                    <FilterChip
                                        key={item.key}
                                        label={item.label}
                                        active={filter === item.key}
                                        onPress={() => setFilter(filter === item.key ? "all" : item.key)}
                                        styles={styles}
                                    />
                                ))}
                            </FilterGroup>
                            <FilterGroup title="Seviye" styles={styles}>
                                {DIFFICULTY_FILTERS.map((item) => (
                                    <FilterChip key={item.key} label={item.label} active={difficulty === item.key} onPress={() => setDifficulty(item.key)} styles={styles} />
                                ))}
                            </FilterGroup>
                            <FilterGroup title="Ekipman" styles={styles}>
                                {EQUIPMENT_FILTERS.map((item) => (
                                    <FilterChip key={item.key} label={item.label} active={equipmentFilters.includes(item.key)} onPress={() => toggleEquipment(item.key)} styles={styles} />
                                ))}
                            </FilterGroup>
                        </ScrollView>

                        <View style={styles.filterActions}>
                            <TouchableOpacity
                                style={styles.secondaryAction}
                                onPress={() => {
                                    setRegion("all");
                                    setFilter("all");
                                    setDifficulty("all");
                                    setEquipmentFilters([]);
                                }}
                            >
                                <Text style={styles.secondaryActionText}>Temizle</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.primaryAction} onPress={() => setFilterModalVisible(false)}>
                                <Text style={styles.primaryActionText}>Uygula</Text>
                            </TouchableOpacity>
                        </View>
            </PremiumModalSurface>
        </>
    );
}

function FilterGroup({ title, children, styles }: { title: string; children: React.ReactNode; styles: any }) {
    return (
        <View style={styles.filterGroup}>
            <Text style={styles.detailTitle}>{title}</Text>
            <View style={styles.filterWrap}>{children}</View>
        </View>
    );
}

function FilterChip({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: any }) {
    return (
        <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress} activeOpacity={0.82}>
            <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function DetailBlock({ title, items, styles, warning = false }: { title: string; items: string[]; styles: any; warning?: boolean }) {
    if (!items.length) return null;
    return (
        <View style={styles.detailBlock}>
            <Text style={styles.detailTitle}>{title}</Text>
            {items.map((item) => (
                <View key={item} style={styles.detailItem}>
                    <Ionicons name={warning ? "alert-circle-outline" : "checkmark-circle-outline"} size={15} color={warning ? "#F5A524" : "#22C55E"} />
                    <Text style={styles.detailText}>{item}</Text>
                </View>
            ))}
        </View>
    );
}

function InfoPill({ label, value, styles }: { label: string; value: string; styles: any }) {
    if (!value) return null;
    return (
        <View style={styles.infoPill}>
            <Text style={styles.infoPillLabel}>{label}</Text>
            <Text style={styles.infoPillValue} numberOfLines={1}>{value}</Text>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
    headerBlock: { gap: spacing.lg },
    header: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
    title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: spacing.xs },
    searchPanel: {
        flexDirection: "row",
        gap: spacing.sm,
        alignItems: "center",
    },
    searchBox: {
        flex: 1,
        minHeight: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: fontSize.sm,
        paddingVertical: spacing.sm,
    },
    filterBtn: {
        minHeight: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accent,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
    },
    guideBtn: {
        width: 46,
        minHeight: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
    },
    filterBtnText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    resultCount: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: -spacing.sm },
    guidePanel: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        gap: spacing.md,
    },
    guideHeader: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    guideIcon: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    guideTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    guideText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, marginTop: 2 },
    groupScroller: { gap: spacing.sm, paddingRight: spacing.md },
    groupGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.md },
    groupCard: {
        width: 160,
        minHeight: 92,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.xs,
    },
    groupCardActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    groupTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    groupTitleActive: { color: colors.accent },
    groupText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
    filterRow: { gap: spacing.sm, paddingVertical: spacing.xs },
    filterGroup: { marginBottom: spacing.lg, gap: spacing.sm },
    filterWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    filterChip: {
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
    filterText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    filterTextActive: { color: colors.accent },
    list: { gap: spacing.md },
    cardPressable: { width: "100%" },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    exerciseName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    exerciseMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    badge: {
        color: colors.accent,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
    },
    cardText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.68)",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
    },
    modalCard: {
        width: "100%",
        maxWidth: 520,
        maxHeight: "86%",
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
    },
    modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
    modalTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    modalSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    modalClose: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalScroll: { maxHeight: 520 },
    filterActions: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    secondaryAction: {
        flex: 1,
        minHeight: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
    },
    secondaryActionText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    primaryAction: {
        flex: 1,
        minHeight: 46,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    primaryActionText: { color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    mediaPreview: {
        flexDirection: "row",
        gap: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    mediaIcon: {
        width: 46,
        height: 46,
        borderRadius: borderRadius.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
    },
    mediaTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    mediaText: { color: colors.textSecondary, fontSize: fontSize.xs, lineHeight: 18, marginTop: 3 },
    mediaLink: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: spacing.xs },
    quickInfoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    patternPanel: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.xs,
    },
    patternTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    patternText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    patternRelated: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
    infoPill: {
        flexGrow: 1,
        minWidth: 128,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    infoPillLabel: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
        marginBottom: 2,
    },
    infoPillValue: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    detailBlock: { gap: spacing.sm, marginBottom: spacing.lg },
    detailTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    detailItem: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    detailText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    noteBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    noteText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    aliasText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
});
