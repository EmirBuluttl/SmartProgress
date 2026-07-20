import AsyncStorage from "@react-native-async-storage/async-storage";

export const APP_TOUR_COMPLETED_KEY = "@smartprogress_app_tour_completed";
export const DETAILED_APP_TOUR_COMPLETED_KEY = "@smartprogress_detailed_app_tour_completed";
export const POST_ONBOARDING_FLOW_PENDING_KEY = "@smartprogress_post_onboarding_flow_pending";
export const ONBOARDING_TRAINING_PENDING_KEY = "@smartprogress_onboarding_training_pending";

type Listener = () => void;
const listeners = new Set<Listener>();
const detailedListeners = new Set<Listener>();

export function subscribeAppTourRequest(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function subscribeDetailedAppTourRequest(listener: Listener) {
    detailedListeners.add(listener);
    return () => {
        detailedListeners.delete(listener);
    };
}

export async function requestAppTourReplay() {
    await AsyncStorage.removeItem(APP_TOUR_COMPLETED_KEY);
    listeners.forEach((listener) => listener());
}

export async function requestDetailedAppTourReplay() {
    await AsyncStorage.removeItem(DETAILED_APP_TOUR_COMPLETED_KEY);
    detailedListeners.forEach((listener) => listener());
}

export async function markAppTourCompleted() {
    await AsyncStorage.setItem(APP_TOUR_COMPLETED_KEY, "true");
}

export async function markDetailedAppTourCompleted() {
    await AsyncStorage.setItem(DETAILED_APP_TOUR_COMPLETED_KEY, "true");
}

export async function hasCompletedAppTour() {
    return (await AsyncStorage.getItem(APP_TOUR_COMPLETED_KEY)) === "true";
}

export async function hasCompletedDetailedAppTour() {
    return (await AsyncStorage.getItem(DETAILED_APP_TOUR_COMPLETED_KEY)) === "true";
}

export async function markPostOnboardingFlowPending() {
    await AsyncStorage.setItem(POST_ONBOARDING_FLOW_PENDING_KEY, "true");
}

export async function clearPostOnboardingFlowPending() {
    await AsyncStorage.removeItem(POST_ONBOARDING_FLOW_PENDING_KEY);
}

export async function hasPendingPostOnboardingFlow() {
    return (await AsyncStorage.getItem(POST_ONBOARDING_FLOW_PENDING_KEY)) === "true";
}

export async function markOnboardingTrainingPending() {
    await AsyncStorage.setItem(ONBOARDING_TRAINING_PENDING_KEY, "true");
}

export async function clearOnboardingTrainingPending() {
    await AsyncStorage.removeItem(ONBOARDING_TRAINING_PENDING_KEY);
}

export async function hasPendingOnboardingTraining() {
    return (await AsyncStorage.getItem(ONBOARDING_TRAINING_PENDING_KEY)) === "true";
}
