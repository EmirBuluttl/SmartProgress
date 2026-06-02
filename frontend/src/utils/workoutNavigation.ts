import type { RootStackParamList } from "../navigation/RootNavigator";
import { restoreActiveSession } from "../services/syncService";

type WorkoutSessionParams = RootStackParamList["WorkoutSession"];
type NavigationLike = {
    navigate: (screen: "WorkoutSession", params?: WorkoutSessionParams) => void;
};

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
