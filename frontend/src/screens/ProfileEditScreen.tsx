// ─────────────────────────────────────────────
// ProfileEditScreen — Profil Düzenleme
// Nickname, FirstName, LastName, Profil Fotoğrafı
// ─────────────────────────────────────────────
import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Image,
    Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { useAuth } from "../store/AuthContext";
import { authApi } from "../services/api";
import AccentButton from "../components/AccentButton";
import AnimatedPressable from "../components/AnimatedPressable";
import NoticeModal from "../components/NoticeModal";
import ActionConfirmModal from "../components/ActionConfirmModal";
import { KeyboardAwareScrollView, KeyboardSafeView } from "../components/KeyboardSafeScreen";

export default function ProfileEditScreen() {
    const navigation = useNavigation();
    const { colors } = useTheme();
    const { user, updateUser } = useAuth();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [nickname, setNickname] = useState((user as any)?.nickname || "");
    const [profileImage, setProfileImage] = useState(user?.avatarUrl || user?.profileImage || "");
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ title: string; message: string; goBackOnClose?: boolean } | null>(null);
    const [photoSourceVisible, setPhotoSourceVisible] = useState(false);

    const closeNotice = () => {
        const shouldGoBack = notice?.goBackOnClose;
        setNotice(null);
        if (shouldGoBack) {
            navigation.goBack();
        }
    };

    const getPickedImageUri = (asset: ImagePicker.ImagePickerAsset) =>
        asset.base64
            ? `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`
            : asset.uri;

    const pickImage = async (source: "camera" | "gallery") => {
        if (source === "camera") {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
                setNotice({ title: "İzin Gerekli", message: "Profil fotoğrafı çekmek için kamera izni vermen gerekiyor." });
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                setProfileImage(getPickedImageUri(result.assets[0]));
            }
        } else {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                setProfileImage(getPickedImageUri(result.assets[0]));
            }
        }
    };

    const handlePickImage = () => {
        if (Platform.OS === "web") {
            pickImage("gallery");
            return;
        }
        setPhotoSourceVisible(true);
    };

    const handleSave = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            setNotice({ title: "Eksik Bilgi", message: "Ad ve soyad alanlarını boş bırakmamalısın." });
            return;
        }

        setSaving(true);
        try {
            await authApi.updateProfile({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                nickname: nickname.trim() || undefined,
                avatarUrl: profileImage || null,
            });

            updateUser({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                avatarUrl: profileImage || null,
                profileImage: profileImage || undefined,
            });

            setNotice({ title: "Profil Güncellendi", message: "Profil bilgilerin başarıyla kaydedildi.", goBackOnClose: true });
        } catch (err: any) {
            setNotice({ title: "Profil Güncellenemedi", message: err?.message || "Profil güncellenemedi. Lütfen tekrar dene." });
        } finally {
            setSaving(false);
        }
    };

    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    return (
        <KeyboardSafeView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <AnimatedPressable
                    onPress={() => navigation.goBack()}
                    style={styles.closeBtn}
                    pressedScale={0.94}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={28} color={colors.text} />
                </AnimatedPressable>
                <Text style={styles.headerTitle}>Profili Düzenle</Text>
                <View style={{ width: 28 }} />
            </View>

            <KeyboardAwareScrollView
                contentContainerStyle={styles.content}
                extraBottomPadding={120}
            >
                {/* Avatar */}
                <AnimatedPressable style={styles.avatarSection} onPress={handlePickImage} pressedScale={0.96}>
                    <View style={styles.avatarLarge}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>{initials}</Text>
                        )}
                        <View style={styles.avatarEditBadge}>
                            <Ionicons name="camera" size={14} color={colors.background} />
                        </View>
                    </View>
                    <Text style={styles.changePhotoText}>Fotoğrafı Değiştir</Text>
                </AnimatedPressable>

                {/* Fields */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Ad</Text>
                    <TextInput
                        style={styles.input}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="Adınız"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Soyad</Text>
                    <TextInput
                        style={styles.input}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Soyadınız"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Kullanıcı Adı</Text>
                    <TextInput
                        style={styles.input}
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder="Opsiyonel"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                    />
                </View>

                {/* Save Button */}
                <AccentButton
                    title="Kaydet"
                    onPress={handleSave}
                    loading={saving}
                    style={styles.saveBtn}
                />
            </KeyboardAwareScrollView>
            <NoticeModal
                visible={!!notice}
                title={notice?.title || ""}
                message={notice?.message || ""}
                onClose={closeNotice}
            />
            <ActionConfirmModal
                visible={photoSourceVisible}
                title="Profil fotografi"
                message="Fotografi kamera ile cekebilir veya galeriden secebilirsin."
                primaryLabel="Kamera"
                secondaryLabel="Galeri"
                onPrimary={() => {
                    setPhotoSourceVisible(false);
                    pickImage("camera");
                }}
                onSecondary={() => {
                    setPhotoSourceVisible(false);
                    pickImage("gallery");
                }}
                onDismiss={() => setPhotoSourceVisible(false)}
            />
        </KeyboardSafeView>
    );
}

// ─── Styles ─────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxxl,
        paddingBottom: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        color: colors.text,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceElevated,
    },
    content: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxxl,
    },
    avatarSection: { alignItems: "center", marginBottom: spacing.xxl },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.accentMuted,
        borderWidth: 3,
        borderColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
    avatarImage: { width: 100, height: 100, borderRadius: 50 },
    avatarText: {
        fontSize: 32,
        fontWeight: fontWeight.heavy,
        color: colors.accent,
    },
    avatarEditBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: colors.accent,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 3,
        borderColor: colors.background,
    },
    changePhotoText: {
        fontSize: fontSize.sm,
        color: colors.accent,
        fontWeight: fontWeight.medium,
    },
    fieldGroup: { marginBottom: spacing.lg },
    label: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.semibold,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: fontSize.md,
        color: colors.text,
    },
    saveBtn: { marginTop: spacing.xl },
});
