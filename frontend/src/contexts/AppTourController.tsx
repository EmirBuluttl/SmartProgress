import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

export type AppTourStepKey =
    | "home.streak"
    | "home.quickWorkout"
    | "home.stats"
    | "home.activeProgram"
    | "home.programs"
    | "home.community"
    | "progress.chart"
    | "progress.records"
    | "coach.hero"
    | "coach.package"
    | "profile.header"
    | "profile.notifications"
    | "profile.rpeRir";

export type AppTourStep = {
    key: AppTourStepKey;
    tabIndex: number;
    title: string;
    body: string;
};

export const INLINE_APP_TOUR_STEPS: AppTourStep[] = [
    {
        key: "home.streak",
        tabIndex: 0,
        title: "Antrenman serin",
        body: "Seri sayaci kac gundur ritmini korudugunu gosterir. Streak arttiginda uygulama bunu ayrica kutlar.",
    },
    {
        key: "home.quickWorkout",
        tabIndex: 0,
        title: "Serbest antrenman",
        body: "Program secmeden hizlica bos log ekrani acip istedigin hareketleri kaydedebilirsin.",
    },
    {
        key: "home.stats",
        tabIndex: 0,
        title: "Antrenman ve progress ozeti",
        body: "Toplam antrenmanini, seri durumunu ve yakalanan progress sinyallerini buradan hizli okursun.",
    },
    {
        key: "home.activeProgram",
        tabIndex: 0,
        title: "Aktif program takibi",
        body: "Takip ettigin programin siradaki gunu burada durur. Antrenmana buradan devam edebilirsin.",
    },
    {
        key: "home.programs",
        tabIndex: 0,
        title: "Program kutuphanen",
        body: "Kendi olusturdugun, kesfetten kaydettigin veya koc ile kurdugun programlar burada toplanir.",
    },
    {
        key: "home.community",
        tabIndex: 0,
        title: "Topluluk programlari",
        body: "Public programlari inceleyebilir, kaydedebilir veya kendi programini paylasabilirsin.",
    },
    {
        key: "progress.chart",
        tabIndex: 1,
        title: "Koc sinyal grafigi",
        body: "Progress, plato ve dusus oranlarini haftalik olarak takip eder; neyin ilerledigini hizlica anlarsin.",
    },
    {
        key: "progress.records",
        tabIndex: 1,
        title: "En iyi setlerim",
        body: "Hareketlerdeki en iyi performanslarin burada saklanir. Istersen video baglantisi ekleyebilirsin.",
    },
    {
        key: "coach.hero",
        tabIndex: 2,
        title: "Premium koc merkezi",
        body: "Program takibi, haftalik raporlar ve aksiyon onerileri burada toplanir.",
    },
    {
        key: "coach.package",
        tabIndex: 2,
        title: "60 gun deneme",
        body: "Yeni kullanicilara kredi karti alinmadan 60 gun Premium/free tier hakki verilir.",
    },
    {
        key: "profile.header",
        tabIndex: 3,
        title: "Profil ve ayarlar",
        body: "Profil bilgilerini, hesap ayarlarini ve tekrar izlenebilir uygulama turunu buradan yonetirsin.",
    },
    {
        key: "profile.notifications",
        tabIndex: 3,
        title: "Hatirlaticilar",
        body: "Antrenman gunlerine ozel notlar ve bildirimleri buradan ayarlayabilirsin.",
    },
    {
        key: "profile.rpeRir",
        tabIndex: 3,
        title: "RPE ve RIR",
        body: "Bu iki veri koc analizini guclendirir. Antrenmanda loglamaya ozen gostermek daha iyi takip saglar.",
    },
];

type FinishReason = "completed" | "skipped";

type AppTourControllerValue = {
    visible: boolean;
    currentIndex: number;
    total: number;
    currentStep: AppTourStep | null;
    currentStepKey: AppTourStepKey | null;
    activeTabIndex: number | null;
    startTour: () => void;
    next: () => void;
    previous: () => void;
    skip: () => void;
    isActiveStep: (key: AppTourStepKey) => boolean;
};

const AppTourControllerContext = createContext<AppTourControllerValue | undefined>(undefined);

export function AppTourControllerProvider({
    children,
    onFinish,
}: {
    children: ReactNode;
    onFinish: (reason: FinishReason) => void | Promise<void>;
}) {
    const [visible, setVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const finishTour = useCallback(
        (reason: FinishReason) => {
            setVisible(false);
            setCurrentIndex(0);
            void onFinish(reason);
        },
        [onFinish],
    );

    const startTour = useCallback(() => {
        setCurrentIndex(0);
        setVisible(true);
    }, []);

    const next = useCallback(() => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= INLINE_APP_TOUR_STEPS.length) {
            finishTour("completed");
            return;
        }
        setCurrentIndex(nextIndex);
    }, [currentIndex, finishTour]);

    const previous = useCallback(() => {
        setCurrentIndex((index) => Math.max(0, index - 1));
    }, []);

    const skip = useCallback(() => {
        finishTour("skipped");
    }, [finishTour]);

    const currentStep = visible ? INLINE_APP_TOUR_STEPS[currentIndex] ?? null : null;

    const value = useMemo<AppTourControllerValue>(
        () => ({
            visible,
            currentIndex,
            total: INLINE_APP_TOUR_STEPS.length,
            currentStep,
            currentStepKey: currentStep?.key ?? null,
            activeTabIndex: currentStep?.tabIndex ?? null,
            startTour,
            next,
            previous,
            skip,
            isActiveStep: (key) => visible && currentStep?.key === key,
        }),
        [currentIndex, currentStep, next, previous, skip, startTour, visible],
    );

    return <AppTourControllerContext.Provider value={value}>{children}</AppTourControllerContext.Provider>;
}

export function useInlineAppTour() {
    const context = useContext(AppTourControllerContext);
    if (!context) {
        throw new Error("useInlineAppTour must be used inside AppTourControllerProvider");
    }
    return context;
}
