import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../store/AuthContext";
import NoticeModal from "../components/NoticeModal";
import { authApi, parseApiError } from "../services/api";

function formatPurchaseError(error: any) {
    const rawMessage = `${error?.message || ""} ${error?.underlyingErrorMessage || ""}`.toLowerCase();
    if (error?.code === "11" || error?.code === 11 || rawMessage.includes("invalid api key")) {
        return Platform.OS === "ios"
            ? "RevenueCat iOS public SDK key bu build icin hatali veya App Store uygulamasi ile eslesmiyor. EAS Secret olarak EXPO_PUBLIC_REVENUECAT_IOS_API_KEY degerini RevenueCat > SmartProgress iOS > Public SDK Key ile birebir guncelle."
            : "RevenueCat Android public SDK key bu build icin hatali veya Google Play uygulamasi ile eslesmiyor. EAS Secret olarak EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY degerini RevenueCat > SmartProgress Android > Public SDK Key ile birebir guncelle.";
    }

    const details = [
        error?.message,
        error?.underlyingErrorMessage,
        error?.readableErrorCode ? `Kod: ${error.readableErrorCode}` : null,
        error?.code ? `Native kod: ${error.code}` : null,
    ].filter(Boolean);

    const uniqueDetails = Array.from(new Set(details));
    return uniqueDetails.length > 0
        ? uniqueDetails.join("\n")
        : "Magaza islemi tamamlanamadi.";
}

function getStoreInstallHint() {
    if (Platform.OS === "ios") {
        return "Satin alma testi icin uygulama TestFlight veya App Store buildi uzerinden kurulmus olmalidir.";
    }
    if (Platform.OS === "android") {
        return "Satin alma testi icin uygulama Google Play ic/kapali test baglantisindan kurulmus olmalidir.";
    }
    return "Satin alma islemleri sadece iOS ve Android uygulama buildlerinde test edilebilir.";
}

function getPriceText(aPackage: any | null, loading: boolean) {
    const priceString = aPackage?.product?.priceString;
    if (priceString) return `${priceString} / ay`;
    if (loading) return "Magaza fiyati yukleniyor";
    return "Fiyat App Store veya Google Play odeme ekraninda gosterilir";
}

export default function PremiumDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { user, updateUser } = useAuth();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const [purchasePackage, setPurchasePackage] = React.useState<any | null>(null);
    const [loadingOffer, setLoadingOffer] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState<{ title: string; message: string } | null>(null);
    const trialDaysLeft = React.useMemo(() => {
        const expiresAt = user?.settings?.pro_trial_expires_at;
        if (!expiresAt) return null;
        const expiresTime = new Date(expiresAt).getTime();
        if (!Number.isFinite(expiresTime)) return null;
        return Math.max(0, Math.ceil((expiresTime - Date.now()) / (1000 * 60 * 60 * 24)));
    }, [user?.settings?.pro_trial_expires_at]);

    const syncBackendEntitlement = React.useCallback(async () => {
        const response = await authApi.syncEntitlements({ appUserId: user?.id });
        updateUser(response.data);
    }, [updateUser, user?.id]);

    React.useEffect(() => {
        let cancelled = false;
        if (!user?.id || purchasePackage || loadingOffer) return;

        const loadOffer = async () => {
            setLoadingOffer(true);
            try {
                const revenueCat = await import("../services/revenueCat");
                const readiness = await revenueCat.getRevenueCatReadiness();
                if (!readiness.ready) return;
                const offerings = await revenueCat.getPremiumOfferings(user.id);
                if (!cancelled) {
                    setPurchasePackage(offerings.packages[0] || null);
                }
            } catch (error) {
                console.warn("Premium offer preload failed", error);
            } finally {
                if (!cancelled) setLoadingOffer(false);
            }
        };

        loadOffer();
        return () => {
            cancelled = true;
        };
    }, [loadingOffer, purchasePackage, user?.id]);

    const handlePurchase = async () => {
        if (!user?.id) return;
        setBusy(true);
        try {
            const revenueCat = await import("../services/revenueCat");
            const readiness = await revenueCat.getRevenueCatReadiness();
            if (!readiness.ready) {
                setNotice({ title: readiness.title, message: readiness.message });
                return;
            }

            let selectedPackage = purchasePackage;
            if (!selectedPackage) {
                setLoadingOffer(true);
                const offerings = await revenueCat.getPremiumOfferings(user.id);
                selectedPackage = offerings.packages[0] || null;
                setPurchasePackage(selectedPackage);
                setLoadingOffer(false);
            }

            if (!selectedPackage) {
                setNotice({
                    title: "Paket bulunamadi",
                    message: "RevenueCat offering icinde Premium paketi gorunmuyor. Store urunlerini ve entitlement eslesmesini kontrol et.",
                });
                return;
            }

            const result = await revenueCat.purchasePremiumPackage(selectedPackage);
            if (result.active) {
                await syncBackendEntitlement();
                setNotice({ title: "Premium aktif", message: "Premium erisimin basariyla acildi." });
            } else {
                setNotice({ title: "Satin alma tamamlandi", message: "Premium entitlement henuz aktif gorunmuyor. Birazdan restore etmeyi dene." });
            }
        } catch (error: any) {
            if (error?.userCancelled) return;
            console.warn("Premium purchase failed", error);
            setNotice({ title: "Satin alma basarisiz", message: formatPurchaseError(error) });
        } finally {
            setLoadingOffer(false);
            setBusy(false);
        }
    };

    const handleRestore = async () => {
        if (!user?.id) return;
        setBusy(true);
        try {
            const revenueCat = await import("../services/revenueCat");
            const readiness = await revenueCat.getRevenueCatReadiness();
            if (!readiness.ready) {
                setNotice({ title: readiness.title, message: readiness.message });
                return;
            }

            const result = await revenueCat.restorePremiumPurchases(user.id);
            if (result.active) {
                await syncBackendEntitlement();
                setNotice({ title: "Satin alma geri yuklendi", message: "Premium erisimin tekrar aktif edildi." });
            } else {
                await syncBackendEntitlement().catch(() => undefined);
                setNotice({ title: "Aktif Premium bulunamadi", message: "Bu magaza hesabinda aktif Premium abonelik gorunmuyor." });
            }
        } catch (error) {
            const apiError = parseApiError(error);
            setNotice({ title: "Restore basarisiz", message: apiError.message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.82}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>SMARTPROGRESS PREMIUM</Text>
                    <Text style={styles.title}>Akilli koc motoru</Text>
                    <Text style={styles.subtitle}>
                        Programini, loglarini ve toparlanma sinyallerini okuyup siradaki en mantikli aksiyonu gosterir.
                    </Text>
                </View>
            </View>

            <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                    <Ionicons name="analytics-outline" size={28} color={colors.background} />
                </View>
                <Text style={styles.heroTitle}>Premium ne yapar?</Text>
                <Text style={styles.heroText}>
                    Premium program kurar, haftalik raporlar, progress/plato/dusus sinyallerini yakalar ve aksiyon adaylarini kullanici onayina birakir.
                </Text>
                <View style={styles.trialInfoBox}>
                    <Ionicons name="hourglass-outline" size={18} color={colors.accent} />
                    <View style={styles.trialInfoCopy}>
                        <Text style={styles.trialInfoTitle}>
                            {trialDaysLeft !== null && trialDaysLeft > 0 ? `${trialDaysLeft} gun Premium deneme` : "Yeni hesaplara 60 gun Premium deneme"}
                        </Text>
                        <Text style={styles.trialInfoText}>
                            Deneme suresinde akilli program wizard, haftalik rapor ve koc sinyalleri acik gelir. Magaza aboneligi deneme bittikten sonra Premium'u surdurmek icindir.
                        </Text>
                    </View>
                </View>
                <View style={styles.subscriptionInfoBox}>
                    <Text style={styles.subscriptionInfoTitle}>Abonelik bilgisi</Text>
                    <InfoRow label="Urun" value="SmartProgress Premium Monthly" colors={colors} />
                    <InfoRow label="Sure" value="1 ay, otomatik yenilenir" colors={colors} />
                    <InfoRow label="Fiyat" value={getPriceText(purchasePackage, loadingOffer)} colors={colors} />
                    <InfoRow label="Yenileme" value="Iptal edilmedigi surece donem sonunda otomatik yenilenir." colors={colors} />
                    <View style={styles.legalLinksRow}>
                        <TouchableOpacity
                            style={styles.legalLinkButton}
                            onPress={() => navigation.navigate("PrivacyPolicy")}
                            activeOpacity={0.78}
                        >
                            <Text style={styles.legalLinkText}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.legalLinkButton}
                            onPress={() => navigation.navigate("TermsOfService")}
                            activeOpacity={0.78}
                        >
                            <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <TouchableOpacity
                    style={[styles.primaryButton, (busy || loadingOffer) && styles.disabledButton]}
                    onPress={handlePurchase}
                    disabled={busy || loadingOffer}
                    activeOpacity={0.82}
                >
                    <Text style={styles.primaryButtonText}>
                        {busy ? "Isleniyor..." : purchasePackage?.product?.priceString ? `Premium'u Baslat - ${purchasePackage.product.priceString}` : "Premium'u Baslat"}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={busy || loadingOffer} activeOpacity={0.78}>
                    <Text style={styles.restoreText}>Satin almayi geri yukle</Text>
                </TouchableOpacity>
                <View style={styles.storePendingBox}>
                    <Ionicons name="storefront-outline" size={18} color={colors.accent} />
                    <Text style={styles.storePendingText}>
                        {getStoreInstallHint()}
                    </Text>
                </View>
            </View>

            <FeatureCard icon="map-outline" title="Kisisel program wizard" text="Seviye, frekans, hedef, ekipman, agri ve kas onceligine gore program olusturur." colors={colors} />
            <FeatureCard icon="document-text-outline" title="Haftalik rapor" text="Yeterli log birikince haftanin progress, takip, plato ve regresyon sinyallerini ozetler." colors={colors} />
            <FeatureCard icon="trending-up-outline" title="Progress takibi" text="Kilo artisi, tekrar artisi ve RIR sinyallerini hareket bazli okuyarak sonraki hedefi netlestirir." colors={colors} />
            <FeatureCard icon="shield-checkmark-outline" title="Karar sende" text="Koc otomatik program degistirmez; onerileri sen onaylamadan uygulamaz." colors={colors} />

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate("CoachWeeklyReport")} activeOpacity={0.82}>
                <Ionicons name="document-text-outline" size={18} color={colors.accent} />
                <Text style={styles.secondaryText}>Haftalik raporu gor</Text>
            </TouchableOpacity>

            <NoticeModal
                visible={!!notice}
                title={notice?.title || ""}
                message={notice?.message || ""}
                onClose={() => setNotice(null)}
            />
        </ScrollView>
    );
}

function InfoRow({ label, value, colors }: {
    label: string;
    value: string;
    colors: any;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );
}

function FeatureCard({ icon, title, text, colors }: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    text: string;
    colors: any;
}) {
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.featureCard}>
            <View style={styles.smallIcon}>
                <Ionicons name={icon} size={18} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardText}>{text}</Text>
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
    header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    backBtn: {
        width: 42,
        height: 42,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.heavy, letterSpacing: 1 },
    title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy, marginTop: spacing.xs },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
    heroCard: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.md,
    },
    heroIcon: {
        width: 54,
        height: 54,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accent,
    },
    heroTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    heroText: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
    trialInfoBox: {
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentMuted,
    },
    trialInfoCopy: { flex: 1, minWidth: 0, gap: 2 },
    trialInfoTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    trialInfoText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 19 },
    subscriptionInfoBox: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: spacing.md,
        gap: spacing.sm,
    },
    subscriptionInfoTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    infoRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
    infoLabel: { width: 76, color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    infoValue: { flex: 1, minWidth: 0, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 19 },
    legalLinksRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
    legalLinkButton: {
        minHeight: 36,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentMuted,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
    legalLinkText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    primaryButton: {
        minHeight: 52,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
    },
    disabledButton: { opacity: 0.64 },
    primaryButtonText: { color: colors.background, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    restoreBtn: { alignSelf: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    restoreText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    storePendingBox: {
        flexDirection: "row",
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.accentBorder,
        backgroundColor: colors.accentMuted,
    },
    storePendingText: { flex: 1, color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 19 },
    featureCard: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    smallIcon: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    cardTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    cardText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
    secondaryBtn: {
        minHeight: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    secondaryText: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
