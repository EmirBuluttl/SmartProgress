// ─────────────────────────────────────────────
// ActiveWorkoutBanner — "Dynamic Island" banner
// Shows when an active workout session is persisted.
// Tappable → navigates back to WorkoutSessionScreen.
// ─────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { spacing, fontSize, fontWeight, borderRadius } from "../constants/theme";
import { useTheme } from "../hooks/ThemeContext";
import { restoreActiveSession } from "../services/syncService";
import type { WorkoutSession } from "../types/workout";

interface Props {
    /** Called externally to force a refresh check */
    refreshKey?: number;
}

function getElapsedSeconds(session: WorkoutSession): number {
    const startedAt = new Date(session.startedAt).getTime();
    const wallClockElapsed = Number.isFinite(startedAt)
        ? Math.floor((Date.now() - startedAt) / 1000)
        : 0;
    return Math.max(0, session.totalDuration || 0, wallClockElapsed);
}

export default function ActiveWorkoutBanner({ refreshKey }: Props) {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();

    const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Check for active session
    useEffect(() => {
        let mounted = true;
        const check = async () => {
            const session = await restoreActiveSession();
            if (mounted) {
                setActiveSession(session);
                if (session) {
                    setElapsed(getElapsedSeconds(session));
                }
            }
        };
        check();
        return () => { mounted = false; };
    }, [refreshKey]);

    // Live timer
    useEffect(() => {
        if (!activeSession) return;
        const interval = setInterval(() => {
            setElapsed(getElapsedSeconds(activeSession));
        }, 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    // Pulse animation
    useEffect(() => {
        if (!activeSession) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [activeSession, pulseAnim]);

    if (!activeSession) return null;

    const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const handlePress = () => {
        // Navigate back to workout session — it will auto-restore from AsyncStorage
        navigation.navigate("WorkoutSession", {
            // Don't pass programData/programId, let it restore from storage
        });
    };

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePress}
            style={[styles.banner, { backgroundColor: colors.accent }]}
        >
            <View style={styles.left}>
                <Animated.View style={{ opacity: pulseAnim }}>
                    <Ionicons name="fitness" size={22} color={colors.background} />
                </Animated.View>
                <View style={styles.textGroup}>
                    <Text style={[styles.title, { color: colors.background }]} numberOfLines={1}>
                        {activeSession.title || "Antrenman Devam Ediyor"}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.background }]}>
                        Geri dönmek için dokun
                    </Text>
                </View>
            </View>
            <View style={[styles.timerBadge, { backgroundColor: colors.background }]}>
                <Ionicons name="time-outline" size={14} color={colors.accent} />
                <Text style={[styles.timerText, { color: colors.accent }]}>
                    {formatTime(elapsed)}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.lg,
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    left: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: spacing.sm,
    },
    textGroup: {
        flex: 1,
    },
    title: {
        fontSize: fontSize.md,
        fontWeight: fontWeight.bold,
    },
    subtitle: {
        fontSize: fontSize.xs,
        opacity: 0.8,
    },
    timerBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    timerText: {
        fontSize: fontSize.sm,
        fontWeight: fontWeight.bold,
    },
});
