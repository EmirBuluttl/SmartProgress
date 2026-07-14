import React from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useAuth } from "../store/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_ANDROID_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    "1078601726148-ft74tfg7c9cjtng2fssjoned1tjgh4sb.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    "1078601726148-bqen7rinub7pnt0g6ljbe988o2sghf7f.apps.googleusercontent.com";
const GOOGLE_WEB_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "1078601726148-v3kr95pa5qoue4al4unb0per68qgp5u4.apps.googleusercontent.com";

type SocialAuthButtonsProps = {
    disabled?: boolean;
    onError: (message: string) => void;
};

function readGoogleIdToken(result: any): string | null {
    if (result?.type !== "success") return null;
    return result?.params?.id_token || result?.authentication?.idToken || null;
}

export default function SocialAuthButtons({ disabled = false, onError }: SocialAuthButtonsProps) {
    const { colors } = useTheme();
    const { loginWithGoogle, loginWithApple } = useAuth();
    const [loadingProvider, setLoadingProvider] = React.useState<"google" | "apple" | null>(null);
    const [appleAvailable, setAppleAvailable] = React.useState(false);
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
        androidClientId: GOOGLE_ANDROID_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        webClientId: GOOGLE_WEB_CLIENT_ID,
        scopes: ["openid", "profile", "email"],
        selectAccount: true,
    });

    React.useEffect(() => {
        if (Platform.OS !== "ios") return;
        AppleAuthentication.isAvailableAsync()
            .then(setAppleAvailable)
            .catch(() => setAppleAvailable(false));
    }, []);

    React.useEffect(() => {
        if (!googleResponse) return;
        const idToken = readGoogleIdToken(googleResponse);
        if (!idToken) {
            if (googleResponse.type === "error") {
                onError("Google girişi tamamlanamadı. Lütfen tekrar deneyin.");
            }
            setLoadingProvider(null);
            return;
        }

        loginWithGoogle({ idToken })
            .catch((error: Error) => onError(error.message || "Google girişi başarısız oldu."))
            .finally(() => setLoadingProvider(null));
    }, [googleResponse, loginWithGoogle, onError]);

    const handleGoogle = async () => {
        if (disabled || loadingProvider) return;
        onError("");
        setLoadingProvider("google");
        try {
            const result = await promptGoogle();
            if (result.type === "dismiss" || result.type === "cancel") {
                setLoadingProvider(null);
            }
        } catch (error: any) {
            setLoadingProvider(null);
            onError(error?.message || "Google girişi başlatılamadı.");
        }
    };

    const handleApple = async () => {
        if (disabled || loadingProvider) return;
        onError("");
        setLoadingProvider("apple");
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                throw new Error("Apple kimlik tokenı alınamadı.");
            }

            await loginWithApple({
                idToken: credential.identityToken,
                email: credential.email || undefined,
                firstName: credential.fullName?.givenName || undefined,
                lastName: credential.fullName?.familyName || undefined,
            });
        } catch (error: any) {
            if (error?.code !== "ERR_REQUEST_CANCELED") {
                onError(error?.message || "Apple ile giriş başarısız oldu.");
            }
        } finally {
            setLoadingProvider(null);
        }
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>veya</Text>
                <View style={styles.divider} />
            </View>

            <TouchableOpacity
                style={[styles.socialButton, (disabled || !googleRequest) && styles.disabledButton]}
                onPress={handleGoogle}
                disabled={disabled || !googleRequest || !!loadingProvider}
                activeOpacity={0.84}
            >
                {loadingProvider === "google" ? (
                    <ActivityIndicator color={colors.text} />
                ) : (
                    <>
                        <Ionicons name="logo-google" size={20} color={colors.text} />
                        <Text style={styles.socialText}>Google ile devam et</Text>
                    </>
                )}
            </TouchableOpacity>

            {appleAvailable && (
                <TouchableOpacity
                    style={[styles.socialButton, disabled && styles.disabledButton]}
                    onPress={handleApple}
                    disabled={disabled || !!loadingProvider}
                    activeOpacity={0.84}
                >
                    {loadingProvider === "apple" ? (
                        <ActivityIndicator color={colors.text} />
                    ) : (
                        <>
                            <Ionicons name="logo-apple" size={22} color={colors.text} />
                            <Text style={styles.socialText}>Apple ile devam et</Text>
                        </>
                    )}
                </TouchableOpacity>
            )}
        </View>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    wrap: {
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    divider: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
    },
    dividerText: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
    },
    socialButton: {
        minHeight: 52,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
    },
    disabledButton: {
        opacity: 0.55,
    },
    socialText: {
        color: colors.text,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
});
