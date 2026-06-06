// ─────────────────────────────────────────────
// LoginScreen — Giriş Yap
// Modern Dark Gym — #3B82F6 accent
// ─────────────────────────────────────────────
import React, { useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    TextInput as TextInputType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useAuth } from "../store/AuthContext";

type LoginNav = NativeStackNavigationProp<AuthStackParamList, "Login">;

export default function LoginScreen() {
    const navigation = useNavigation<LoginNav>();
    const { login } = useAuth();
    const { colors } = useTheme();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const passwordRef = useRef<TextInputType>(null);
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const handleLogin = async () => {
        setError(null);
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedEmail || !password) {
            setError("E-posta ve şifre alanları boş bırakılamaz.");
            return;
        }

        setLoading(true);
        try {
            await login(trimmedEmail, password);
            // Navigation handled automatically via AuthContext isAuthenticated change
        } catch (err: any) {
            setError(err.message || "Giriş başarısız. Bilgilerinizi kontrol edin.");
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        navigation.navigate("ForgotPassword");
    };

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Logo / Brand ─── */}
                <View style={styles.brand}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="barbell" size={36} color={colors.background} />
                    </View>
                    <Text style={styles.appName}>SmartProgress</Text>
                    <Text style={styles.tagline}>Her antrenmanı bir veri noktasına dönüştür.</Text>
                </View>

                {/* ─── Card ─── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Tekrar Hoş Geldin 👋</Text>

                    {/* Error Banner */}
                    {error && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={16} color={colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* E-posta */}
                    <Text style={styles.label}>E-posta</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="ornek@email.com"
                            placeholderTextColor={colors.textMuted}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="next"
                            onSubmitEditing={() => passwordRef.current?.focus()}
                        />
                    </View>

                    {/* Şifre */}
                    <Text style={styles.label}>Şifre</Text>
                    <View style={styles.inputWrap}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                            ref={passwordRef}
                            style={[styles.input, { flex: 1 }]}
                            placeholder="••••••••"
                            placeholderTextColor={colors.textMuted}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword((s) => !s)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons
                                name={showPassword ? "eye-off-outline" : "eye-outline"}
                                size={20}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Forgot Password */}
                    <TouchableOpacity
                        onPress={handleForgotPassword}
                        style={styles.forgotBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                    </TouchableOpacity>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleLogin}
                        activeOpacity={0.85}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.background} />
                        ) : (
                            <Text style={styles.btnText}>Giriş Yap</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ─── Register Link ─── */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Hesabın yok mu?</Text>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("Register")}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.footerLink}> Kayıt Ol</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xxxl,
    },
    brand: {
        alignItems: "center",
        marginBottom: spacing.xxxl + spacing.xl,
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.md,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
    appName: {
        fontSize: fontSize.xxxl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
        textAlign: "center",
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        marginBottom: spacing.xl,
    },
    cardTitle: {
        fontSize: fontSize.xl,
        fontWeight: fontWeight.bold,
        color: colors.text,
        marginBottom: spacing.xl,
    },
    errorBanner: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(239,68,68,0.12)",
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: "rgba(239,68,68,0.3)",
    },
    errorText: {
        flex: 1,
        fontSize: fontSize.sm,
        color: colors.error,
    },
    label: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    inputWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceElevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        minHeight: 56,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: fontSize.md,
        color: colors.text,
        paddingVertical: 0,
    },
    forgotBtn: {
        alignSelf: "flex-end",
        marginTop: spacing.sm,
    },
    forgotText: {
        fontSize: fontSize.sm,
        color: colors.accent,
        fontWeight: fontWeight.medium,
    },
    btn: {
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.xl,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    btnText: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
        color: colors.background,
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    footerText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
    },
    footerLink: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
});
