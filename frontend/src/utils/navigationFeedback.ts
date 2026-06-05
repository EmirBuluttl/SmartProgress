export type NavigationFeedbackVariant = "detail" | "modal";

type NavigationFeedbackOptions = {
    variant?: NavigationFeedbackVariant;
    preDelayMs?: number;
};

export function navigateWithFeedback(navigate: () => void, _options: NavigationFeedbackOptions = {}) {
    navigate();
}
