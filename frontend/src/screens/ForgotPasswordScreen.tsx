import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { authApi, parseApiError } from "../services/api";

type Nav = NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
type Route = RouteProp<AuthStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [email, setEmail] = useState("");
    const [token, setToken] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [requesting, setRequesting] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<"request" | "reset">("request");

    useEffect(() => {
        const routeToken = route.params?.token;
        if (routeToken) {
            setToken(String(routeToken));
            setStep("reset");
            setMessage("Sıfırlama bağlantısı alındı. Yeni şifreni belirleyebilirsin.");
        }
    }, [route.params?.token]);

    const requestReset = async () => {
        setError(null);
        setMessage(null);
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail) {
            setError("E-posta alanı boş bırakılamaz.");
            return;
        }

        setRequesting(true);
        try {
            const res = await authApi.forgotPassword({ email: trimmedEmail });
            setMessage(res.data.message || "Şifre sıfırlama bağlantısı hazırlandı.");
            if (res.data.resetToken) {
                setToken(res.data.resetToken);
                setStep("reset");
            }
            if (!res.data.resetToken) {
                setStep("reset");
            }
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setRequesting(false);
        }
    };

    const resetPassword = async () => {
        setError(null);
        setMessage(null);
        if (!token.trim()) {
            setError("Sıfırlama kodu boş bırakılamaz.");
            return;
        }
        if (password.length < 8) {
            setError("Yeni şifre en az 8 karakter olmalı.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Şifreler eşleşmiyor.");
            return;
        }

        setResetting(true);
        try {
            const res = await authApi.resetPassword({ token: token.trim(), password });
            setMessage(res.data.message || "Şifreniz güncellendi.");
            setPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setResetting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={26} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Şifre Sıfırla</Text>
                    <View style={styles.backBtn} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {step === "request" ? "Hesabını bulalım" : "Yeni şifreni belirle"}
                    </Text>
                    <Text style={styles.cardText}>
                        {step === "request"
                            ? "Kayıtlı e-posta adresini yaz. Hesap varsa sıfırlama bağlantısı hazırlanır."
                            : "E-postadaki sıfırlama kodunu ve yeni şifreni gir."}
                    </Text>

                    {error && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={16} color={colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}
                    {message && (
                        <View style={styles.successBanner}>
                            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                            <Text style={styles.successText}>{message}</Text>
                        </View>
                    )}

                    {step === "request" ? (
                        <>
                            <Text style={styles.label}>E-posta</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="ornek@email.com"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onSubmitEditing={requestReset}
                                />
                            </View>
                            <TouchableOpacity
                                style={[styles.primaryBtn, requesting && styles.disabledBtn]}
                                onPress={requestReset}
                                disabled={requesting}
                            >
                                {requesting ? (
                                    <ActivityIndicator color={colors.background} />
                                ) : (
                                    <Text style={styles.primaryText}>Sıfırlama Bağlantısı Al</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep("reset")}>
                                <Text style={styles.secondaryText}>Kodum var</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <Text style={styles.label}>Sıfırlama kodu</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="key-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    value={token}
                                    onChangeText={setToken}
                                    placeholder="E-postadaki kod"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                />
                            </View>

                            <Text style={styles.label}>Yeni şifre</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="En az 8 karakter"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                />
                            </View>

                            <Text style={styles.label}>Yeni şifre tekrar</Text>
                            <View style={styles.inputWrap}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={styles.input}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Tekrar yaz"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry
                                    onSubmitEditing={resetPassword}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryBtn, resetting && styles.disabledBtn]}
                                onPress={resetPassword}
                                disabled={resetting}
                            >
                                {resetting ? (
                                    <ActivityIndicator color={colors.background} />
                                ) : (
                                    <Text style={styles.primaryText}>Şifreyi Güncelle</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep("request")}>
                                <Text style={styles.secondaryText}>E-posta adımına dön</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl + spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.xl,
    },
    backBtn: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
    },
    cardTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    cardText: {
        fontSize: fontSize.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    inputWrap: {
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: fontSize.md,
        paddingVertical: 0,
    },
    primaryBtn: {
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: borderRadius.md,
        backgroundColor: colors.accent,
        marginTop: spacing.xl,
    },
    disabledBtn: { opacity: 0.6 },
    primaryText: {
        color: colors.background,
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    secondaryBtn: {
        alignItems: "center",
        paddingVertical: spacing.md,
        marginTop: spacing.sm,
    },
    secondaryText: {
        color: colors.accent,
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
    errorBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: "rgba(239,68,68,0.12)",
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.3)",
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    errorText: { flex: 1, color: colors.error, fontSize: fontSize.sm },
    successBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.accentMuted,
        borderWidth: 1,
        borderColor: colors.accent,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    successText: { flex: 1, color: colors.accent, fontSize: fontSize.sm },
});
