// ─────────────────────────────────────────────
// RegisterScreen — Kayıt Ol
// Modern Dark Gym — #CCFF00 accent
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
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/AuthStack";
import AccentButton from "../components/AccentButton";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useAuth } from "../store/AuthContext";

type RegisterNav = NativeStackNavigationProp<AuthStackParamList, "Register">;

interface FieldError {
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
}

// ─── Field Component (Module Scope — prevents keyboard dismiss on re-render) ──

function Field({
    label,
    icon,
    value,
    onChangeText,
    placeholder,
    keyboardType = "default",
    autoCapitalize = "none",
    returnKeyType = "next",
    onSubmitEditing,
    innerRef,
    secureTextEntry = false,
    showToggle = false,
    onToggle,
    errorText,
    colors,
    styles,
}: {
    label: string;
    icon: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    keyboardType?: any;
    autoCapitalize?: any;
    returnKeyType?: any;
    onSubmitEditing?: () => void;
    innerRef?: React.RefObject<TextInputType | null>;
    secureTextEntry?: boolean;
    showToggle?: boolean;
    onToggle?: () => void;
    errorText?: string;
    colors: any;
    styles: any;
}) {
    // We still have `spacing` imported globally, but let's make sure it's available.
    return (
        <View style={{ marginBottom: spacing.sm }}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputWrap, errorText ? styles.inputError : null]}>
                <Ionicons name={icon as any} size={20} color={errorText ? colors.error : colors.textMuted} style={styles.inputIcon} />
                <TextInput
                    ref={innerRef}
                    style={[styles.input]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={false}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    secureTextEntry={secureTextEntry}
                />
                {showToggle && onToggle && (
                    <TouchableOpacity
                        onPress={onToggle}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons
                            name={secureTextEntry ? "eye-outline" : "eye-off-outline"}
                            size={20}
                            color={colors.textMuted}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {errorText ? <Text style={styles.fieldError}>{errorText}</Text> : null}
        </View>
    );
}

// ─── Password Strength Indicator ────────────

function PasswordStrength({ password, colors, pwStyles }: { password: string, colors: any, pwStyles: any }) {
    if (!password) return null;
    const strength =
        password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)
            ? 3
            : password.length >= 8
            ? 2
            : 1;
    const labels = ["", "Zayıf", "Orta", "Güçlü"];
    const barColors = ["", colors.error, colors.warning, colors.success];
    return (
        <View style={pwStyles.container}>
            <View style={pwStyles.bars}>
                {[1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={[
                            pwStyles.bar,
                            { backgroundColor: i <= strength ? barColors[strength] : colors.border },
                        ]}
                    />
                ))}
            </View>
            <Text style={[pwStyles.label, { color: barColors[strength] }]}>{labels[strength]}</Text>
        </View>
    );
}

// ─── Screen ─────────────────────────────────

export default function RegisterScreen() {
    const navigation = useNavigation<RegisterNav>();
    const { register } = useAuth();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<FieldError>({});

    const lastNameRef = useRef<TextInputType | null>(null);
    const emailRef = useRef<TextInputType | null>(null);
    const passwordRef = useRef<TextInputType | null>(null);
    const confirmRef = useRef<TextInputType | null>(null);

    const validate = (): boolean => {
        const errs: FieldError = {};
        if (!firstName.trim()) errs.firstName = "Ad gerekli.";
        if (!lastName.trim()) errs.lastName = "Soyad gerekli.";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.test(email.trim())) {
            errs.email = "Geçerli bir e-posta girin.";
        }
        if (password.length < 8) {
            errs.password = "Şifre en az 8 karakter olmalı.";
        }
        if (password !== confirmPassword) {
            errs.confirmPassword = "Şifreler eşleşmiyor.";
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleRegister = async () => {
        if (!validate()) return;

        setLoading(true);
        try {
            await register({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim().toLowerCase(),
                password,
            });
            // Navigation handled automatically via AuthContext isAuthenticated change
        } catch (err: any) {
            setErrors({ general: err.message || "Kayıt başarısız. Lütfen tekrar deneyin." });
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        navigation.navigate("ForgotPassword");
    };

    const pwStyles = React.useMemo(() => createPwStyles(colors), [colors]);

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
                {/* ─── Header ─── */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.logoCircle}>
                        <Ionicons name="barbell" size={28} color={colors.background} />
                    </View>
                    <Text style={styles.title}>Hesap Oluştur</Text>
                    <Text style={styles.subtitle}>SmartProgress'e katıl ve gelişimini takip et.</Text>
                </View>

                {/* ─── Form Card ─── */}
                <View style={styles.card}>
                    {/* General error */}
                    {errors.general && (
                        <View style={styles.errorBanner}>
                            <Ionicons name="alert-circle" size={16} color={colors.error} />
                            <Text style={styles.errorText}>{errors.general}</Text>
                        </View>
                    )}

                    {/* Name row */}
                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                            <Field
                                label="Ad"
                                icon="person-outline"
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder="Adın"
                                autoCapitalize="words"
                                returnKeyType="next"
                                onSubmitEditing={() => lastNameRef.current?.focus()}
                                errorText={errors.firstName}
                                colors={colors}
                                styles={styles}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field
                                label="Soyad"
                                icon="person-outline"
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder="Soyadın"
                                autoCapitalize="words"
                                returnKeyType="next"
                                innerRef={lastNameRef}
                                onSubmitEditing={() => emailRef.current?.focus()}
                                errorText={errors.lastName}
                                colors={colors}
                                styles={styles}
                            />
                        </View>
                    </View>

                    <Field
                        label="E-posta"
                        icon="mail-outline"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="ornek@email.com"
                        keyboardType="email-address"
                        returnKeyType="next"
                        innerRef={emailRef}
                        onSubmitEditing={() => passwordRef.current?.focus()}
                        errorText={errors.email}
                        colors={colors}
                        styles={styles}
                    />

                    <Field
                        label="Şifre"
                        icon="lock-closed-outline"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="En az 8 karakter"
                        returnKeyType="next"
                        innerRef={passwordRef}
                        onSubmitEditing={() => confirmRef.current?.focus()}
                        secureTextEntry={!showPassword}
                        showToggle
                        onToggle={() => setShowPassword((s) => !s)}
                        errorText={errors.password}
                        colors={colors}
                        styles={styles}
                    />

                    <Field
                        label="Şifre Tekrarı"
                        icon="shield-checkmark-outline"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Şifreni tekrar gir"
                        returnKeyType="done"
                        innerRef={confirmRef}
                        onSubmitEditing={handleRegister}
                        secureTextEntry={!showConfirm}
                        showToggle
                        onToggle={() => setShowConfirm((s) => !s)}
                        errorText={errors.confirmPassword}
                        colors={colors}
                        styles={styles}
                    />

                    {/* Password strength hint */}
                    <PasswordStrength password={password} colors={colors} pwStyles={pwStyles} />

                    {/* Forgot Password */}
                    <TouchableOpacity
                        onPress={handleForgotPassword}
                        style={styles.forgotBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="help-circle-outline" size={16} color={colors.textMuted} />
                        <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                    </TouchableOpacity>

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleRegister}
                        activeOpacity={0.85}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.background} />
                        ) : (
                            <Text style={styles.btnText}>Kayıt Ol →</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ─── Login Link ─── */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Zaten hesabın var mı?</Text>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.footerLink}> Giriş Yap</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const createPwStyles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    bars: { flexDirection: "row", flex: 1, gap: 4 },
    bar: { flex: 1, height: 3, borderRadius: 2 },
    label: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, minWidth: 36 },
});

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: {
        flexGrow: 1,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxxl,
        paddingTop: spacing.xl,
    },
    header: {
        alignItems: "center",
        marginBottom: spacing.xxl,
        paddingTop: spacing.xl,
    },
    backBtn: {
        position: "absolute",
        left: 0,
        top: spacing.xl,
        padding: spacing.xs,
    },
    logoCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.md,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    title: {
        fontSize: fontSize.xxl,
        fontWeight: fontWeight.heavy,
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
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
    row: {
        flexDirection: "row",
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
        marginTop: spacing.sm,
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
    inputError: {
        borderColor: colors.error,
        backgroundColor: "rgba(239,68,68,0.06)",
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        fontSize: fontSize.md,
        color: colors.text,
        paddingVertical: 0,
        flex: 1,
    },
    fieldError: {
        fontSize: fontSize.xs,
        color: colors.error,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
    forgotBtn: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-end",
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    forgotText: {
        fontSize: fontSize.sm,
        color: colors.textMuted,
        fontWeight: fontWeight.medium,
    },
    btn: {
        backgroundColor: colors.accent,
        borderRadius: borderRadius.md,
        minHeight: 56,
        alignItems: "center",
        justifyContent: "center",
        marginTop: spacing.lg,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    btnDisabled: { opacity: 0.6 },
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
    footerText: { fontSize: fontSize.sm, color: colors.textMuted },
    footerLink: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
        color: colors.accent,
    },
});

