import { Platform } from "react-native";
import type { PurchasesPackage, PurchasesStoreProduct } from "react-native-purchases";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "";
export const PREMIUM_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID || "premium";
export const PREMIUM_PRODUCT_ID = process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_PRODUCT_ID || "smartprogress_premium_monthly";

let configuredForUserId: string | null = null;

function getPurchasesModule() {
    try {
        const module = require("react-native-purchases");
        return {
            Purchases: module.default || module,
            LOG_LEVEL: module.LOG_LEVEL,
            PRODUCT_CATEGORY: module.PRODUCT_CATEGORY,
        };
    } catch {
        return null;
    }
}

function getPlatformKey() {
    if (Platform.OS === "ios") return IOS_API_KEY;
    if (Platform.OS === "android") return ANDROID_API_KEY;
    return "";
}

export function isRevenueCatConfigured() {
    return Platform.OS === "ios" || Platform.OS === "android"
        ? !!getPlatformKey()
        : false;
}

async function isLikelyInstalledFromGooglePlay() {
    if (Platform.OS !== "android") return true;

    try {
        const application = require("expo-application");
        if (typeof application?.getInstallReferrerAsync !== "function") {
            return true;
        }

        await application.getInstallReferrerAsync();
        return true;
    } catch {
        return false;
    }
}

export async function getRevenueCatReadiness() {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
        return {
            ready: false,
            title: "Mağaza bu platformda yok",
            message: "Satın alma işlemleri sadece Android ve iOS uygulama buildlerinde çalışır.",
        };
    }

    if (!getPlatformKey()) {
        return {
            ready: false,
            title: "Mağaza bağlantısı hazır değil",
            message: "RevenueCat public SDK key bu build içine eklenmemiş.",
        };
    }

    if (Platform.OS === "android") {
        const installedFromGooglePlay = await isLikelyInstalledFromGooglePlay();
        if (!installedFromGooglePlay) {
            return {
                ready: false,
                title: "Google Play kurulumu gerekli",
                message: "Premium satın alma testi için uygulamayı Google Play iç test bağlantısından kurmalısın. Direkt indirilen APK/AAB ile Play Billing güvenli şekilde başlatılmaz.",
            };
        }
    }

    return { ready: true, title: "", message: "" };
}

export async function configureRevenueCat(userId: string) {
    const readiness = await getRevenueCatReadiness();
    if (!readiness.ready) return false;

    const apiKey = getPlatformKey();
    if (!apiKey) return false;
    if (configuredForUserId === userId) return true;
    const module = getPurchasesModule();
    if (!module?.Purchases) return false;

    await module.Purchases.setLogLevel(__DEV__ ? module.LOG_LEVEL.DEBUG : module.LOG_LEVEL.WARN);
    module.Purchases.configure({ apiKey, appUserID: userId });
    configuredForUserId = userId;
    return true;
}

export async function getPremiumOfferings(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return { current: null, packages: [] as PurchasesPackage[] };
    const module = getPurchasesModule();
    if (!module?.Purchases) return { current: null, packages: [] as PurchasesPackage[] };
    const offerings = await module.Purchases.getOfferings();
    return {
        current: offerings.current,
        packages: offerings.current?.availablePackages || [],
    };
}

export async function getPremiumStoreProducts(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return [] as PurchasesStoreProduct[];
    const module = getPurchasesModule();
    if (!module?.Purchases) return [] as PurchasesStoreProduct[];
    return module.Purchases.getProducts([PREMIUM_PRODUCT_ID], module.PRODUCT_CATEGORY?.SUBSCRIPTION);
}

export function hasPremiumEntitlement(customerInfo: any) {
    return customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID]?.isActive === true ||
        customerInfo?.entitlements?.all?.[PREMIUM_ENTITLEMENT_ID]?.isActive === true;
}

export async function purchasePremiumPackage(aPackage: PurchasesPackage) {
    const module = getPurchasesModule();
    if (!module?.Purchases) throw new Error("Mağaza bağlantısı bu cihazda hazır değil.");
    const result = await module.Purchases.purchasePackage(aPackage);
    return {
        customerInfo: result.customerInfo,
        active: hasPremiumEntitlement(result.customerInfo),
    };
}

export async function purchasePremiumStoreProduct(product: PurchasesStoreProduct) {
    const module = getPurchasesModule();
    if (!module?.Purchases) throw new Error("MaÄŸaza baÄŸlantÄ±sÄ± bu cihazda hazÄ±r deÄŸil.");
    const result = await module.Purchases.purchaseStoreProduct(product);
    return {
        customerInfo: result.customerInfo,
        active: hasPremiumEntitlement(result.customerInfo),
    };
}

export async function restorePremiumPurchases(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return { customerInfo: null, active: false };
    const module = getPurchasesModule();
    if (!module?.Purchases) return { customerInfo: null, active: false };
    const customerInfo = await module.Purchases.restorePurchases();
    return { customerInfo, active: hasPremiumEntitlement(customerInfo) };
}

export async function refreshPremiumCustomerInfo(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return { customerInfo: null, active: false };
    const module = getPurchasesModule();
    if (!module?.Purchases) return { customerInfo: null, active: false };
    const customerInfo = await module.Purchases.getCustomerInfo();
    return { customerInfo, active: hasPremiumEntitlement(customerInfo) };
}
