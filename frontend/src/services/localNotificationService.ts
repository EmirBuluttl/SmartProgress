import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { WorkoutSession } from "../types/workout";

const NOTIFICATIONS_ENABLED_KEY = "smartprogress_local_notifications_enabled";
const ACTIVE_WORKOUT_NOTIFICATION_ID_KEY = "smartprogress_active_workout_notification_id";
const ACTIVE_WORKOUT_SESSION_ID_KEY = "smartprogress_active_workout_session_id";
const ACTIVE_WORKOUT_NOTIFICATION_BUCKET_KEY = "smartprogress_active_workout_notification_bucket";
const PRE_WORKOUT_NOTIFICATION_PREFIX = "smartprogress_pre_workout_notification";
const PRE_WORKOUT_LOOKAHEAD_DAYS = 14;
const DEFAULT_PRE_WORKOUT_HOUR = 9;
const DEFAULT_PRE_WORKOUT_MINUTE = 0;

const ACTIVE_WORKOUT_CHANNEL_ID = "active-workout";
const REMINDER_CHANNEL_ID = "workout-reminders";

type NavigationLike = {
    navigate: (screen: any, params?: any) => void;
};

type ReminderInput = {
    programId: string;
    programName: string;
    dayIndex: number;
    dayLabel: string;
    note: string;
};

type ProgramReminderSettings = {
    programName?: string;
    days?: Record<string, { enabled?: boolean; note?: string }>;
};

type ProgramReminderScheduleInput = {
    programId: string;
    programName: string;
    currentDayIndex?: number;
    days: Array<{ label?: string; isRestDay?: boolean }>;
    reminders?: ProgramReminderSettings;
};

function isNativeNotificationsAvailable() {
    return Platform.OS === "ios" || Platform.OS === "android";
}

if (isNativeNotificationsAvailable()) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

async function getStoredNotificationId(key: string) {
    return AsyncStorage.getItem(key);
}

async function cancelStoredNotification(key: string) {
    const id = await getStoredNotificationId(key);
    if (id) {
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
        await Notifications.dismissNotificationAsync(id).catch(() => undefined);
        await AsyncStorage.removeItem(key);
    }
}

function formatElapsed(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(safeSeconds / 3600);
    const m = Math.floor((safeSeconds % 3600) / 60);
    const s = safeSeconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getSessionElapsedSeconds(session: WorkoutSession): number {
    const startedAt = new Date(session.startedAt).getTime();
    const wallClockElapsed = Number.isFinite(startedAt)
        ? Math.floor((Date.now() - startedAt) / 1000)
        : 0;
    return Math.max(0, session.totalDuration || 0, wallClockElapsed);
}

export async function setupLocalNotificationChannels() {
    if (!isNativeNotificationsAvailable()) return false;

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(ACTIVE_WORKOUT_CHANNEL_ID, {
            name: "Aktif Antrenman",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
            name: "Antrenman Hatirlaticilari",
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    }

    return true;
}

export async function areLocalNotificationsEnabled() {
    if (!isNativeNotificationsAvailable()) return false;
    return (await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY)) === "true";
}

export async function requestLocalNotificationPermission() {
    if (!isNativeNotificationsAvailable()) return false;

    await setupLocalNotificationChannels();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted === true;
}

export async function setLocalNotificationsEnabled(enabled: boolean) {
    if (!enabled) {
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
        await cancelActiveWorkoutNotification();
        await cancelAllPreWorkoutReminderNotifications();
        return true;
    }

    const granted = await requestLocalNotificationPermission();
    if (!granted) {
        await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
        return false;
    }

    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
    return true;
}

export async function scheduleActiveWorkoutNotification(session: WorkoutSession) {
    if (!isNativeNotificationsAvailable()) return;
    if (!(await areLocalNotificationsEnabled())) return;
    if (!session?.id || session.status !== "active") return;

    await setupLocalNotificationChannels();
    const existingSessionId = await AsyncStorage.getItem(ACTIVE_WORKOUT_SESSION_ID_KEY);
    const existingNotificationId = await AsyncStorage.getItem(ACTIVE_WORKOUT_NOTIFICATION_ID_KEY);
    const elapsedBucket = String(Math.floor(getSessionElapsedSeconds(session) / 60));
    const existingBucket = await AsyncStorage.getItem(ACTIVE_WORKOUT_NOTIFICATION_BUCKET_KEY);
    if (existingSessionId === session.id && existingNotificationId && existingBucket === elapsedBucket) return;

    await cancelStoredNotification(ACTIVE_WORKOUT_NOTIFICATION_ID_KEY);

    const title = session.title?.trim() || "Antrenman devam ediyor";
    const elapsedText = formatElapsed(getSessionElapsedSeconds(session));
    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: "Antrenman devam ediyor",
            body: `${title} aktif. Sure: ${elapsedText}. Devam etmek icin dokun.`,
            data: {
                action: "active-workout",
                sessionId: session.id,
            },
            sound: false,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
            channelId: ACTIVE_WORKOUT_CHANNEL_ID,
        },
    });

    await AsyncStorage.setItem(ACTIVE_WORKOUT_NOTIFICATION_ID_KEY, notificationId);
    await AsyncStorage.setItem(ACTIVE_WORKOUT_SESSION_ID_KEY, session.id);
    await AsyncStorage.setItem(ACTIVE_WORKOUT_NOTIFICATION_BUCKET_KEY, elapsedBucket);
}

export async function cancelActiveWorkoutNotification() {
    if (!isNativeNotificationsAvailable()) return;
    await cancelStoredNotification(ACTIVE_WORKOUT_NOTIFICATION_ID_KEY);
    await AsyncStorage.removeItem(ACTIVE_WORKOUT_SESSION_ID_KEY);
    await AsyncStorage.removeItem(ACTIVE_WORKOUT_NOTIFICATION_BUCKET_KEY);
}

function getReminderStorageKey(input: Pick<ReminderInput, "programId" | "dayIndex">, dateKey = new Date().toISOString().slice(0, 10)) {
    return `${PRE_WORKOUT_NOTIFICATION_PREFIX}:${dateKey}:${input.programId}:${input.dayIndex}`;
}

function buildReminderDate(offsetDays: number) {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    target.setHours(DEFAULT_PRE_WORKOUT_HOUR, DEFAULT_PRE_WORKOUT_MINUTE, 0, 0);
    return target;
}

async function schedulePreWorkoutReminder(input: ReminderInput, targetDate: Date) {
    if (!isNativeNotificationsAvailable()) return;
    if (!(await areLocalNotificationsEnabled())) return;
    if (!input.programId || !input.note.trim()) return;

    await setupLocalNotificationChannels();
    const key = getReminderStorageKey(input, targetDate.toISOString().slice(0, 10));
    const existing = await AsyncStorage.getItem(key);
    if (existing) return;
    if (targetDate.getTime() <= Date.now()) return;

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: "Antrenman hatirlatmasi",
            body: `${input.programName} - ${input.dayLabel}: ${input.note.trim()}`,
            data: {
                action: "program-detail",
                programId: input.programId,
            },
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: targetDate,
            channelId: REMINDER_CHANNEL_ID,
        },
    });

    await AsyncStorage.setItem(key, notificationId);
}

export async function scheduleTodayPreWorkoutReminderIfNeeded(input: ReminderInput) {
    return schedulePreWorkoutReminder(input, buildReminderDate(0));
}

export async function reschedulePreWorkoutRemindersForProgram(input: ProgramReminderScheduleInput) {
    if (!isNativeNotificationsAvailable()) return;
    if (!(await areLocalNotificationsEnabled())) return;
    if (!input.programId || !Array.isArray(input.days) || input.days.length === 0) return;

    await cancelAllPreWorkoutReminderNotifications();
    await setupLocalNotificationChannels();

    const currentDayIndex = Number.isFinite(input.currentDayIndex)
        ? Math.max(0, Number(input.currentDayIndex))
        : 0;
    const cycleLength = input.days.length;
    const tasks: Promise<void>[] = [];

    for (let offset = 0; offset < PRE_WORKOUT_LOOKAHEAD_DAYS; offset += 1) {
        const dayIndex = (currentDayIndex + offset) % cycleLength;
        const day = input.days[dayIndex];
        if (!day || day.isRestDay) continue;
        const reminder = input.reminders?.days?.[String(dayIndex)];
        const note = String(reminder?.note || "").trim();
        if (reminder?.enabled !== true || !note) continue;

        tasks.push(schedulePreWorkoutReminder({
            programId: input.programId,
            programName: input.programName,
            dayIndex,
            dayLabel: day.label || `Gun ${dayIndex + 1}`,
            note,
        }, buildReminderDate(offset)));
    }

    await Promise.all(tasks);
}

export async function cancelAllPreWorkoutReminderNotifications() {
    if (!isNativeNotificationsAvailable()) return;
    const keys = await AsyncStorage.getAllKeys();
    const reminderKeys = keys.filter((key) => key.startsWith(PRE_WORKOUT_NOTIFICATION_PREFIX));
    await Promise.all(reminderKeys.map((key) => cancelStoredNotification(key)));
}

export function registerLocalNotificationResponseHandler(navigation: NavigationLike) {
    if (!isNativeNotificationsAvailable()) return () => undefined;

    const handleResponse = (response: Notifications.NotificationResponse | null | undefined) => {
        if (!response) return;
        const data = response.notification.request.content.data || {};
        const action = String((data as any).action || "");

        if (action === "active-workout") {
            navigation.navigate("WorkoutSession", {});
            return;
        }

        if (action === "program-detail" && (data as any).programId) {
            navigation.navigate("ProgramDetail", { programId: String((data as any).programId) });
            return;
        }

        navigation.navigate("MainTabs", { screen: "Home" });
    };

    Notifications.getLastNotificationResponseAsync()
        .then(handleResponse)
        .catch(() => undefined);

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => subscription.remove();
}
