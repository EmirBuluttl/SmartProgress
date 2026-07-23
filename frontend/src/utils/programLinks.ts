import { Linking, Platform } from "react-native";

export const PROGRAM_SHARE_BASE_URL = "https://app.smartprogress.online/programs";
export const PROGRAM_APP_LINK_BASE_URL = "smartprogress://programs";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.smartprogress.app";
export const APP_STORE_URL = "https://apps.apple.com/app/id6780054560";

export function buildProgramShareUrl(programId: string) {
    return `${PROGRAM_SHARE_BASE_URL}/${programId}`;
}

export function buildProgramAppUrl(programId: string) {
    return `${PROGRAM_APP_LINK_BASE_URL}/${programId}`;
}

export function buildAndroidIntentUrl(programId: string) {
    return [
        `intent://programs/${programId}`,
        "#Intent",
        "scheme=smartprogress",
        "package=com.smartprogress.app",
        `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)}`,
        "end",
    ].join(";");
}

export function getStoreUrl(platform: typeof Platform.OS = Platform.OS) {
    return platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
}

export function isMobileWebUserAgent() {
    const nav = (globalThis as any)?.navigator;
    const ua = String(nav?.userAgent || "");
    return /Android|iPhone|iPad|iPod/i.test(ua);
}

export function isAndroidWebUserAgent() {
    const nav = (globalThis as any)?.navigator;
    const ua = String(nav?.userAgent || "");
    return /Android/i.test(ua);
}

export function openStoreForCurrentPlatform() {
    const url = getStoreUrl();
    return Linking.openURL(url);
}

export function openProgramDeepLink(programId: string) {
    if (Platform.OS === "web") {
        const win = (globalThis as any)?.window;
        if (win?.location) {
            win.location.href = isAndroidWebUserAgent()
                ? buildAndroidIntentUrl(programId)
                : buildProgramAppUrl(programId);
            return Promise.resolve();
        }
    }
    return Linking.openURL(buildProgramAppUrl(programId));
}
