export type ProgramGuideSection = {
    title: string;
    body: string;
    icon?: string;
};

export type ProgramIntro = {
    title?: string;
    sections?: ProgramGuideSection[];
    summary?: string[];
    source?: "coach" | "manual";
};

export const PROGRAM_GUIDE_SUMMARY_RULES = [
    "Antrenmana isinmadan baslama.",
    "Setlerini kg ve tekrar olarak logla; mumkunse RPE/RIR da gir.",
    "Progressi uzun vadede takip et, tek kotu antrenmana takilma.",
    "Programi sik degistirme; calisan programi sabirla surdur.",
    "Agri veya sakatlik varsa ilgili bolgeyi zorlamadan hareket et.",
];

export const MANUAL_GUIDE_TEMPLATES: ProgramGuideSection[] = [
    {
        title: "Progress kuralı",
        body: "Agirlik veya tekrarlar form bozulmadan artiyorsa program calisiyor demektir. Tek kotu antrenman yuzunden programi degistirme.",
        icon: "trending-up-outline",
    },
    {
        title: "RPE/RIR notu",
        body: "RPE ve RIR loglamak program takibini guclendirir. Bu veriler ne kadar duzenli girilirse gelisim analizi o kadar anlamli olur.",
        icon: "speedometer-outline",
    },
    {
        title: "Dinlenme notu",
        body: "Setlere acele girme. Kendini hazir hissettiginde sete basla; genel dinlenme hedefi 3-5 dakika araligidir.",
        icon: "timer-outline",
    },
    {
        title: "Program değiştirme notu",
        body: "Sevmedigin veya sana uygun olmayan hareketleri degistirebilirsin; fakat sik program degistirmek adaptasyonu basa sarabilir.",
        icon: "repeat-outline",
    },
    {
        title: "Ağrı/sakatlık notu",
        body: "Hareket sirasinda agri veya aci hissedersen hareketi birak. Gerekirse program detayindan agri/sakatlik bildirimi yap.",
        icon: "medkit-outline",
    },
];

const cleanText = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.trim();
};

export function normalizeProgramIntro(input: unknown): ProgramIntro | null {
    if (!input || typeof input !== "object") return null;
    const raw = input as any;
    const sections = Array.isArray(raw.sections)
        ? raw.sections
            .map((section: any) => ({
                title: cleanText(section?.title),
                body: cleanText(section?.body),
                icon: cleanText(section?.icon) || undefined,
            }))
            .filter((section: ProgramGuideSection) => section.title && section.body)
        : [];
    const summary = Array.isArray(raw.summary)
        ? raw.summary.map(cleanText).filter(Boolean)
        : [];

    if (!sections.length && !summary.length) return null;

    return {
        title: cleanText(raw.title) || "Program rehberi",
        sections,
        summary,
        source: raw.source === "manual" ? "manual" : raw.source === "coach" ? "coach" : undefined,
    };
}

export function buildGuideSections(intro: ProgramIntro | null): ProgramGuideSection[] {
    if (!intro?.sections?.length) return [];
    return intro.sections.slice(0, 10);
}

export function buildGuideSummary(intro: ProgramIntro | null): string[] {
    if (intro?.summary?.length) return intro.summary.slice(0, 5);
    if (!intro?.sections?.length) return [];
    return intro.sections.slice(0, 5).map((section) => section.title);
}

export function buildManualProgramIntro(sections: ProgramGuideSection[]): ProgramIntro | undefined {
    const cleaned = sections
        .map((section) => ({
            title: cleanText(section.title),
            body: cleanText(section.body),
            icon: cleanText(section.icon) || undefined,
        }))
        .filter((section) => section.title && section.body);

    if (!cleaned.length) return undefined;

    return {
        title: "Program rehberi",
        source: "manual",
        summary: PROGRAM_GUIDE_SUMMARY_RULES,
        sections: cleaned,
    };
}
