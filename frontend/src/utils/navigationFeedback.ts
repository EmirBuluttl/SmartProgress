export function navigateWithFeedback(navigate: () => void, delayMs = 90) {
    setTimeout(navigate, delayMs);
}
