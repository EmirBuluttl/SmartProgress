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
        subtitle: "SmartProgress'in hangi verileri neden kullandığını açık ve anlaşılır şekilde özetler.",
        sections: [
            {
                title: "Topladığımız Veriler",
                body: "Aşağıdaki kişisel ve kullanım verilerini işleriz:\n\n• Hesap bilgileri (e-posta adresi, ad)\n• Antrenman logları ve egzersiz geçmişi\n• Vücut ölçümleri (kilo, boy, vücut yağ oranı vb.)\n• Beslenme kayıtları\n• Program ve egzersiz verileri\n• Koç AI etkileşim geçmişi (yalnızca Premium kullanıcılar)\n• Abonelik ve satın alma bilgileri\n• Cihaz bilgileri (işletim sistemi, uygulama versiyonu)",
            },
            {
                title: "Verilerin Kullanım Amacı",
                body: "Topladığımız veriler yalnızca aşağıdaki amaçlar doğrultusunda kullanılır:\n\n• Antrenman geçmişini kaydetmek ve saklamak\n• İlerleme analizi ve grafikleri oluşturmak\n• AI koç önerileri sunmak (yalnızca Premium)\n• Abonelik yönetimi ve erişim doğrulaması\n• Uygulama güvenliği ve dolandırıcılık önleme\n• Teknik sorunların tespit edilmesi ve giderilmesi",
            },
            {
                title: "Üçüncü Taraf Hizmetler",
                body: "Uygulama yalnızca aşağıdaki üçüncü taraf hizmetlerle çalışmaktadır:\n\n• RevenueCat — Abonelik ve ödeme doğrulaması için kullanılır. RevenueCat'in kendi gizlilik politikası geçerlidir.\n\n• OpenAI — Yalnızca Premium kullanıcılara sunulan AI koç özelliği için kullanılır. AI koç ile yapılan sohbet içerikleri OpenAI altyapısında işlenir.\n\n• E-posta Sağlayıcısı — Şifre sıfırlama e-postalarının iletilmesi için kullanılır.\n\nBu hizmetler dışında verileriniz hiçbir üçüncü tarafla paylaşılmaz veya satılmaz.",
            },
            {
                title: "Veri Güvenliği",
                body: "Verilerinizin güvenliği için aşağıdaki önlemler uygulanmaktadır:\n\n• Tüm veri iletimi şifreli bağlantı (HTTPS/TLS) üzerinden gerçekleştirilir.\n• Veriler güvenli sunucu altyapısında (Amazon EC2 / GCP) depolanır.\n• Şifreler asla düz metin olarak saklanmaz; güçlü kriptografik hash algoritmaları kullanılır.\n\nHiçbir sistem %100 güvenli değildir; olası bir ihlal tespit edilirse sizi gecikmeksizin bilgilendiririz.",
            },
            {
                title: "Veri Saklama",
                body: "Verileriniz hesabınız aktif olduğu sürece saklanır. Hesabınızı sildiğinizde tüm kişisel verileriniz, antrenman kayıtlarınız, ölçümleriniz ve beslenme geçmişiniz 30 gün içinde sistemlerimizden kalıcı olarak silinir. Bu süre olası teknik sorunlara karşı geri yükleme imkânı sunmak amacıyla uygulanır.",
            },
            {
                title: "Haklarınız",
                body: "Verileriniz üzerinde aşağıdaki haklara sahipsiniz:\n\n• Erişim hakkı: Hakkınızdaki verilerin bir kopyasını talep edebilirsiniz.\n• Düzeltme hakkı: Yanlış veya eksik bilgilerin güncellenmesini isteyebilirsiniz.\n• Silme hakkı: Hesabınızı ve ilişkili tüm verilerinizi silebilirsiniz.\n• Abonelik iptali: App Store veya Google Play abonelik yönetimi üzerinden gerçekleştirilir.\n\nTalep ve sorularınız için support@smartprogress.online adresine ulaşabilirsiniz.",
            },
            {
                title: "Veri Silme",
                body: "Hesabınızı ve tüm verilerinizi silmek için:\n\n1. Uygulama içi yol: Profil > Ayarlar > Hesabı ve Verileri Sil\n\n2. E-posta yolu (uygulamaya erişim yoksa): Kayıtlı e-posta adresinizden support@smartprogress.online adresine 'Hesap Silme Talebi' konusuyla yazın.\n\nSilme işlemi geri alınamaz. Aktif aboneliğinizi ayrıca App Store veya Google Play üzerinden iptal etmeniz gerekir.",
            },
            {
                title: "İletişim",
                body: "Gizlilik politikamıza ilişkin soru veya talepleriniz için:\n\nE-posta: support@smartprogress.online\n\nSon güncelleme: Haziran 2025",
            },
        ],
    },
    TermsOfService: {
        eyebrow: "LEGAL",
        title: "Kullanım Koşulları",
        subtitle: "SmartProgress uygulamasını kullanarak aşağıdaki koşulları kabul etmiş olursunuz.",
        sections: [
            {
                title: "Kabul ve Uyumluluk",
                body: "SmartProgress, 18 yaş ve üzeri bireyler için tasarlanmış bir fitness takip uygulamasıdır. Uygulamayı indirerek veya kullanarak bu Kullanım Koşulları'nı okuduğunuzu, anladığınızı ve tüm hükümleri kabul ettiğinizi beyan etmiş olursunuz. Koşulları kabul etmiyorsanız uygulamayı kullanmaktan vazgeçmenizi rica ederiz.",
            },
            {
                title: "Hizmet Kapsamı",
                body: "SmartProgress aşağıdaki hizmetleri sunar:\n\n• Antrenman takibi ve egzersiz loglama\n• Program oluşturma ve yönetimi\n• AI koç önerileri (yalnızca Premium aboneler)\n• İlerleme analizi ve grafikler\n• Vücut ölçümü ve beslenme takibi\n\nHizmetin kesintisiz veya hatasız çalışacağı garanti edilmez. Bakım, güncelleme veya öngörülemeyen teknik sorunlar nedeniyle kısa süreli kesintiler yaşanabilir.",
            },
            {
                title: "Premium Abonelik",
                body: "Premium abonelikler RevenueCat altyapısı üzerinden yönetilmektedir.\n\n• Aylık Premium abonelik seçeneği mevcuttur.\n• Ücretlendirme, App Store veya Google Play hesabınıza yansıtılır.\n• Abonelik iptalini ilgili mağazanın abonelik yönetimi bölümünden gerçekleştirmelisiniz.\n• Kısmi kullanım süresi için iade yapılmamaktadır.\n• Abonelik, iptal edilmediği sürece mevcut dönem sonunda otomatik olarak yenilenir.",
            },
            {
                title: "Sağlık Sorumluluk Reddi",
                body: "SmartProgress bir fitness takip aracıdır; tıbbi tavsiye, teşhis veya tedavi hizmeti sunmaz. Uygulama içeriği ve AI koç önerileri tıbbi görüş yerine geçmez.\n\nHerhangi bir egzersiz veya beslenme programına başlamadan önce doktorunuza ya da sağlık uzmanınıza danışmanızı şiddetle tavsiye ederiz. Egzersiz sırasında veya sonrasında meydana gelebilecek yaralanma, sağlık sorunu veya zararlardan SmartProgress sorumlu tutulamaz.",
            },
            {
                title: "Hesap Güvenliği",
                body: "Hesabınızın güvenliğini sağlamak sizin sorumluluğunuzdadır:\n\n• Şifrenizi kimseyle paylaşmayın.\n• Hesabınızda yetkisiz erişim veya şüpheli bir aktivite fark ettiğinizde derhal support@smartprogress.online adresine bildirin.\n• Başkasının hesabını izinsiz kullanmak yasaktır.\n\nHesap güvenliğini ihmal eden kullanıcıların uğrayabileceği veri kayıplarından SmartProgress sorumlu değildir.",
            },
            {
                title: "Fikri Mülkiyet",
                body: "SmartProgress uygulamasındaki tüm içerik, tasarım, grafik, yazılım, marka ve logoların fikri mülkiyet hakları SmartProgress'e aittir.\n\n• Uygulama içerikleri izinsiz kopyalanamaz, dağıtılamaz veya ticari amaçlarla kullanılamaz.\n• Uygulamanın kaynak koduna erişim, tersine mühendislik veya türev ürün oluşturma kesinlikle yasaktır.",
            },
            {
                title: "Kullanıcı İçeriği ve Moderasyon",
                body: "Public profil, profil fotoğrafı ve public program açıklamaları kullanıcı tarafından oluşturulan içerik sayılabilir. Hakaret, taciz, spam, yanıltıcı bilgi, uygunsuz görsel veya yasa dışı içerik paylaşmak yasaktır.\n\nKullanıcılar public profil, profil fotoğrafı ve public programları uygulama içinden şikayet edebilir ve diğer kullanıcıları engelleyebilir. Şikayetler manuel olarak incelenir; gerekli görülürse içerik gizlenebilir, profil public görünürlüğü kapatılabilir veya hesap işlem görebilir.",
            },
            {
                title: "Değişiklikler",
                body: "SmartProgress, bu Kullanım Koşulları'nı önceden bildirim yaparak güncelleme hakkını saklı tutar. Güncellemeler uygulama içi bildirim veya kayıtlı e-posta adresinize gönderilecek mesajla duyurulur.\n\nGüncelleme sonrasında uygulamayı kullanmaya devam etmeniz, yeni koşulları kabul ettiğiniz anlamına gelir.",
            },
            {
                title: "İletişim",
                body: "Kullanım Koşulları'na ilişkin soru veya talepleriniz için:\n\nE-posta: support@smartprogress.online\n\nSon güncelleme: Haziran 2025",
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
    if (routeName === "TermsOfService") return COPY.TermsOfService;
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
