import type { RootStackParamList } from "../navigation/RootNavigator";
import { programApi } from "../services/api";
import { restoreActiveSession } from "../services/syncService";
import AsyncStorage from "@react-native-async-storage/async-storage";

type WorkoutSessionParams = RootStackParamList["WorkoutSession"];
type NavigationLike = {
    navigate: (screen: "WorkoutSession", params?: WorkoutSessionParams) => void;
};

export const ACTIVE_PROGRAM_KEY = "active_program_id";
export const LEGACY_ACTIVE_PROGRAM_KEY = "program_favorite_id";

export type StartableProgram = {
    id: string;
    name: string;
    data: WorkoutSessionParams["programData"];
};

export function buildTrackedWorkoutParams(program: StartableProgram, dayIndex = 0): WorkoutSessionParams {
    return {
        programId: program.id,
        programName: program.name,
        dayIndex,
        programData: program.data,
    };
}

export function buildPreviewWorkoutParams(program: StartableProgram, dayIndex = 0): WorkoutSessionParams {
    return {
        programName: program.name,
        dayIndex,
        programData: program.data,
    };
}

export async function getActiveProgramId() {
    return (
        await AsyncStorage.getItem(ACTIVE_PROGRAM_KEY)
    ) || (
        await AsyncStorage.getItem(LEGACY_ACTIVE_PROGRAM_KEY)
    );
}

export async function setActiveProgramId(programId: string) {
    await AsyncStorage.setItem(ACTIVE_PROGRAM_KEY, programId);
    await AsyncStorage.removeItem(LEGACY_ACTIVE_PROGRAM_KEY);
}

export async function clearActiveProgramId() {
    await AsyncStorage.removeItem(ACTIVE_PROGRAM_KEY);
    await AsyncStorage.removeItem(LEGACY_ACTIVE_PROGRAM_KEY);
}

export async function activateProgramForWorkout(programId: string, previousActiveProgramId?: string | null) {
    const activeProgramId = previousActiveProgramId ?? await getActiveProgramId();

    if (activeProgramId && activeProgramId !== programId) {
        try {
            await programApi.setDay(activeProgramId, 0);
        } catch (error) {
            console.warn("[WorkoutNavigation] Eski aktif program sirasi sifirlanamadi:", error);
        }
    }

    try {
        await programApi.setDay(programId, 0);
    } catch (error) {
        console.warn("[WorkoutNavigation] Yeni aktif program sirasi sifirlanamadi:", error);
    }

    await setActiveProgramId(programId);
}

export async function navigateToWorkoutRespectingActiveSession(
    navigation: NavigationLike,
    params: WorkoutSessionParams,
) {
    const activeSession = await restoreActiveSession();
    if (activeSession) {
        navigation.navigate("WorkoutSession", {});
        return { restoredActiveSession: true };
    }

    navigation.navigate("WorkoutSession", params);
    return { restoredActiveSession: false };
}
