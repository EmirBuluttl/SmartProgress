import React from "react";
import { Animated, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useScreenEnter } from "../hooks/useScreenEnter";

const SUPPORT_EMAIL = "support@smartprogress.online";

const COPY = {
    PrivacyPolicy: {
        eyebrow: "LEGAL",
        title: "Gizlilik Politikası",
        subtitle: "SmartProgress'in hangi verileri neden kullandığını açık ve kısa şekilde özetler.",
        sections: [
            {
                title: "Topladığımız veriler",
                body: "Hesap bilgileri, antrenman logları, program verileri, vücut ölçüleri, beslenme kayıtları, koç sinyalleri ve abonelik durumunu işleriz.",
            },
            {
                title: "Kullanım amacı",
                body: "Bu veriler antrenman geçmişini saklamak, progress grafikleri üretmek, Premium koç sinyalleri sunmak, hesap güvenliğini sağlamak ve abonelik erişimini doğrulamak için kullanılır.",
            },
            {
                title: "Üçüncü taraflar",
                body: "Abonelik doğrulaması için RevenueCat, şifre sıfırlama e-postaları için yapılandırılmış e-posta sağlayıcısı ve sadece aktifse AI sağlayıcısı kullanılabilir.",
            },
            {
                title: "Veri silme",
                body: "Profil > Ayarlar > Hesabı ve Verileri Sil yolundan hesabını ve ilişkili verilerini silebilirsin. Uygulamaya erişemiyorsan hesap silme sayfasındaki destek yolunu kullanabilirsin.",
            },
        ],
    },
    Support: {
        eyebrow: "HELP",
        title: "Destek",
        subtitle: "Abonelik, hesap, veri silme veya teknik sorunlarda bize ulaşabilirsin.",
        sections: [
            {
                title: "İletişim",
                body: `Destek e-postası: ${SUPPORT_EMAIL}`,
            },
            {
                title: "Ne yazmalısın?",
                body: "Sorunu, kullandığın cihazı, hesabındaki e-posta adresini ve mümkünse ekran görüntüsünü ekle. Abonelik sorunlarında mağaza faturasını paylaşman süreci hızlandırır.",
            },
            {
                title: "Yanıt süresi",
                body: "Launch döneminde talepleri öncelik sırasına göre ele alacağız. Hesap silme ve abonelik sorunları öncelikli kabul edilir.",
            },
        ],
    },
    AccountDeletion: {
        eyebrow: "DATA",
        title: "Hesap ve Veri Silme",
        subtitle: "SmartProgress hesabını ve ilişkili verilerini nasıl silebileceğini açıklar.",
        sections: [
            {
                title: "Uygulama içinden silme",
                body: "Profil > Ayarlar > Hesabı ve Verileri Sil adımını kullan. Bu işlem hesabını, antrenmanlarını, programlarını, ölçü ve beslenme kayıtlarını kalıcı olarak siler.",
            },
            {
                title: "Uygulamaya erişemiyorsan",
                body: `Kayıtlı e-posta adresinden ${SUPPORT_EMAIL} adresine hesap silme talebi gönderebilirsin. Kimlik doğrulaması için ek bilgi isteyebiliriz.`,
            },
            {
                title: "Abonelik notu",
                body: "Hesap silme mağaza aboneliğini otomatik iptal etmeyebilir. Google Play veya App Store abonelik yönetiminden aktif aboneliğini ayrıca kontrol et.",
            },
        ],
    },
} as const;

type LegalRouteName = keyof typeof COPY;

function getContent(routeName: string) {
    if (routeName === "Support") return COPY.Support;
    if (routeName === "AccountDeletion") return COPY.AccountDeletion;
    return COPY.PrivacyPolicy;
}

export default function LegalInfoScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = React.useMemo(() => createStyles(colors), [colors]);
    const { animStyle } = useScreenEnter({ variant: "slide" });
    const content = getContent(route.name as LegalRouteName);

    return (
        <Animated.View style={[styles.root, animStyle, { paddingTop: insets.top + spacing.lg }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.82}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.eyebrow}>{content.eyebrow}</Text>
                    <Text style={styles.title}>{content.title}</Text>
                    <Text style={styles.subtitle}>{content.subtitle}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
                {content.sections.map((section) => (
                    <View key={section.title} style={styles.card}>
                        <Text style={styles.cardTitle}>{section.title}</Text>
                        <Text style={styles.cardText}>{section.body}</Text>
                    </View>
                ))}

                <TouchableOpacity
                    style={styles.supportButton}
                    activeOpacity={0.82}
                    onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
                >
                    <Ionicons name="mail-outline" size={18} color={colors.background} />
                    <Text style={styles.supportButtonText}>Destek ile iletişime geç</Text>
                </TouchableOpacity>
            </ScrollView>
        </Animated.View>
    );
}

const createStyles = (colors: ReturnType<typeof import("../hooks/ThemeContext").generateColors>) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingHorizontal: spacing.xl },
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
    eyebrow: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.heavy },
    title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.heavy, marginTop: spacing.xs },
    subtitle: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
    card: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    cardText: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
    supportButton: {
        minHeight: 50,
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    supportButtonText: { color: colors.background, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
