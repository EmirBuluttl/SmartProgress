import { Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "";
export const PREMIUM_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID || "premium";

let configuredForUserId: string | null = null;

function getPurchasesModule() {
    try {
        const module = require("react-native-purchases");
        return {
            Purchases: module.default || module,
            LOG_LEVEL: module.LOG_LEVEL,
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

export async function configureRevenueCat(userId: string) {
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
