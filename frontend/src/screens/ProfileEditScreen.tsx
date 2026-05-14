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
    ScrollView,
    Alert,
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

    const pickImage = async (source: "camera" | "gallery") => {
        if (source === "camera") {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("İzin Gerekli", "Lütfen kamera iznini verin.");
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                setProfileImage(result.assets[0].uri);
            }
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("İzin Gerekli", "Lütfen galeri iznini verin.");
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                setProfileImage(result.assets[0].uri);
            }
        }
    };

    const handlePickImage = () => {
        if (Platform.OS === "web") {
            pickImage("gallery");
            return;
        }
        Alert.alert("Profil Fotoğrafı", "Fotoğraf kaynağını seç", [
            { text: "Kamera", onPress: () => pickImage("camera") },
            { text: "Galeri", onPress: () => pickImage("gallery") },
            { text: "İptal", style: "cancel" },
        ]);
    };

    const handleSave = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Hata", "Ad ve Soyad alanları boş bırakılamaz.");
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

            Alert.alert("Başarılı", "Profiliniz güncellendi.", [
                { text: "Tamam", onPress: () => navigation.goBack() },
            ]);
        } catch (err: any) {
            Alert.alert("Hata", err?.message || "Profil güncellenemedi.");
        } finally {
            setSaving(false);
        }
    };

    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profili Düzenle</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Avatar */}
                <TouchableOpacity style={styles.avatarSection} onPress={handlePickImage} activeOpacity={0.8}>
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
                </TouchableOpacity>

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
            </ScrollView>
        </View>
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
