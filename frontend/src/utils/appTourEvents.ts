import AsyncStorage from "@react-native-async-storage/async-storage";

export const APP_TOUR_COMPLETED_KEY = "@smartprogress_app_tour_completed";

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeAppTourRequest(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function requestAppTourReplay() {
    await AsyncStorage.removeItem(APP_TOUR_COMPLETED_KEY);
    listeners.forEach((listener) => listener());
}

export async function markAppTourCompleted() {
    await AsyncStorage.setItem(APP_TOUR_COMPLETED_KEY, "true");
}

export async function hasCompletedAppTour() {
    return (await AsyncStorage.getItem(APP_TOUR_COMPLETED_KEY)) === "true";
}
