// ─────────────────────────────────────────────
// Cross-platform confirm dialog
// Alert.alert with multiple buttons doesn't work on Expo Web.
// This utility uses window.confirm on web and Alert.alert on native.
// ─────────────────────────────────────────────
import { Alert, Platform } from "react-native";

/**
 * Show a confirmation dialog that works on both web and native.
 * Returns a Promise that resolves to true (confirmed) or false (cancelled).
 */
export function confirmDialog(title: string, message: string): Promise<boolean> {
    if (Platform.OS === "web") {
        return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }

    return new Promise((resolve) => {
        Alert.alert(title, message, [
            { text: "İptal", style: "cancel", onPress: () => resolve(false) },
            { text: "Evet", style: "destructive", onPress: () => resolve(true) },
        ]);
    });
}

/**
 * Show a simple info alert that works on both web and native.
 */
export function showAlert(title: string, message: string): void {
    if (Platform.OS === "web") {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
}
