import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AccentButton from "../components/AccentButton";
import { borderRadius, fontSize, fontWeight, spacing } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";

export default function CardioSessionScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const styles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            <Ionicons name="pulse-outline" size={34} color={colors.accent} />
            <Text style={styles.title}>Kardiyo</Text>
            <Text style={styles.subtitle}>Kardiyo log akisi hazirlaniyor.</Text>
            <AccentButton title="Antrenmana Don" onPress={() => navigation.goBack()} />
        </View>
    );
}

function createStyles(colors: any) {
    return StyleSheet.create({
        container: {
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.xl,
            backgroundColor: colors.background,
            gap: spacing.md,
        },
        title: {
            color: colors.textPrimary,
            fontSize: fontSize.xxl,
            fontWeight: fontWeight.bold,
        },
        subtitle: {
            color: colors.textSecondary,
            fontSize: fontSize.md,
            textAlign: "center",
            marginBottom: spacing.md,
            padding: spacing.lg,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.surface,
        },
    });
}
