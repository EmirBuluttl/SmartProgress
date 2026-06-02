export type MainTabKey = "Home" | "MyProgress" | "Coach" | "Profile";

type MainTabListener = (tabKey: MainTabKey) => void;

const listeners = new Set<MainTabListener>();

export function requestMainTabSwitch(tabKey: MainTabKey) {
    listeners.forEach((listener) => listener(tabKey));
}

export function subscribeMainTabSwitch(listener: MainTabListener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
