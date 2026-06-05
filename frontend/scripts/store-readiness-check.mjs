import fs from "node:fs";

const requiredFiles = [
    "app.json",
    "eas.json",
    "assets/icon.png",
    "assets/adaptive-icon.png",
    "assets/splash.png",
    "src/services/revenueCat.ts",
];

const recommendedEnv = [
    "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
    "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
    "EXPO_PUBLIC_REVENUECAT_PREMIUM_ENTITLEMENT_ID",
    "EXPO_PUBLIC_PRIVACY_URL",
    "EXPO_PUBLIC_SUPPORT_URL",
    "EXPO_PUBLIC_ACCOUNT_DELETION_URL",
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file));
const missingEnv = recommendedEnv.filter((key) => !process.env[key]);

if (missingFiles.length > 0) {
    console.error("Missing required store files:");
    missingFiles.forEach((file) => console.error(`- ${file}`));
    process.exitCode = 1;
}

if (missingEnv.length > 0) {
    console.warn("Store env values not set in this shell. They can be provided through EAS secrets:");
    missingEnv.forEach((key) => console.warn(`- ${key}`));
}

if (missingFiles.length === 0) {
    console.log("Store readiness file check passed.");
}
