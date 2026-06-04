export type NavigationFeedbackVariant = "detail" | "modal";

type NavigationFeedbackEvent = {
    id: number;
    variant: NavigationFeedbackVariant;
};

type NavigationFeedbackOptions = {
    variant?: NavigationFeedbackVariant;
    preDelayMs?: number;
};

type NavigationFeedbackListener = (event: NavigationFeedbackEvent) => void;

const listeners = new Set<NavigationFeedbackListener>();
let eventId = 0;

export function subscribeNavigationFeedback(listener: NavigationFeedbackListener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function emitNavigationFeedback(variant: NavigationFeedbackVariant) {
    const event = { id: ++eventId, variant };
    listeners.forEach((listener) => listener(event));
}

export function navigateWithFeedback(navigate: () => void, options: NavigationFeedbackOptions = {}) {
    const variant = options.variant ?? "detail";
    const preDelayMs = options.preDelayMs ?? 135;
    emitNavigationFeedback(variant);
    setTimeout(navigate, preDelayMs);
}
