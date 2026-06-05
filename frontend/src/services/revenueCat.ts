import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, PurchasesPackage } from "react-native-purchases";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "";
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "";
export const PREMIUM_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID || "premium";

let configuredForUserId: string | null = null;

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

    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: userId });
    configuredForUserId = userId;
    return true;
}

export async function getPremiumOfferings(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return { current: null, packages: [] as PurchasesPackage[] };
    const offerings = await Purchases.getOfferings();
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
    const result = await Purchases.purchasePackage(aPackage);
    return {
        customerInfo: result.customerInfo,
        active: hasPremiumEntitlement(result.customerInfo),
    };
}

export async function restorePremiumPurchases(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return { customerInfo: null, active: false };
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo, active: hasPremiumEntitlement(customerInfo) };
}

export async function refreshPremiumCustomerInfo(userId: string) {
    const configured = await configureRevenueCat(userId);
    if (!configured) return { customerInfo: null, active: false };
    const customerInfo = await Purchases.getCustomerInfo();
    return { customerInfo, active: hasPremiumEntitlement(customerInfo) };
}
