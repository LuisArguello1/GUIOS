import { useEffect, useRef } from 'react';

export const LAST_ACTIVITY_STORAGE_KEY = 'guios_last_activity';

const ACTIVITY_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
];

const ACTIVITY_WRITE_THROTTLE_MS = 10_000;
const IDLE_CHECK_INTERVAL_MS = 15_000;

interface UseSessionIdleTimeoutOptions {
    enabled: boolean;
    timeoutSeconds: number;
    onIdleLogout: () => void | Promise<void>;
}

function readStoredActivity(): number {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
        const parsed = raw ? Number(raw) : 0;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
        return 0;
    }
}

function writeStoredActivity(timestamp: number): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(timestamp));
    } catch {
        // Ignorar errores de cuota/modo privado en localStorage
    }
}

export function useSessionIdleTimeout({
    enabled,
    timeoutSeconds,
    onIdleLogout,
}: UseSessionIdleTimeoutOptions): void {
    const lastActivityRef = useRef<number>(0);
    const lastPersistedRef = useRef<number>(0);
    const triggeredRef = useRef<boolean>(false);
    const onIdleLogoutRef = useRef(onIdleLogout);

    useEffect(() => {
        onIdleLogoutRef.current = onIdleLogout;
    }, [onIdleLogout]);

    useEffect(() => {
        if (!enabled || timeoutSeconds <= 0) {
            triggeredRef.current = false;
            return undefined;
        }

        const timeoutMs = timeoutSeconds * 1000;
        const now = Date.now();
        triggeredRef.current = false;
        lastActivityRef.current = now;
        lastPersistedRef.current = now;
        writeStoredActivity(now);

        const checkIdleAndExpire = (): boolean => {
            if (triggeredRef.current) return true;

            const latest = Math.max(lastActivityRef.current, readStoredActivity());
            if (latest > lastActivityRef.current) {
                lastActivityRef.current = latest;
            }

            if (Date.now() - lastActivityRef.current >= timeoutMs) {
                triggeredRef.current = true;
                void onIdleLogoutRef.current();
                return true;
            }
            return false;
        };

        const handleUserActivity = () => {
            if (triggeredRef.current) return;
            const current = Date.now();
            lastActivityRef.current = current;
            if (current - lastPersistedRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
                lastPersistedRef.current = current;
                writeStoredActivity(current);
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== LAST_ACTIVITY_STORAGE_KEY || !event.newValue) return;
            const parsed = Number(event.newValue);
            if (Number.isFinite(parsed) && parsed > lastActivityRef.current) {
                lastActivityRef.current = parsed;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkIdleAndExpire();
            }
        };

        for (const eventName of ACTIVITY_EVENTS) {
            window.addEventListener(eventName, handleUserActivity, { passive: true });
        }
        window.addEventListener('storage', handleStorage);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const intervalId = window.setInterval(checkIdleAndExpire, IDLE_CHECK_INTERVAL_MS);

        return () => {
            for (const eventName of ACTIVITY_EVENTS) {
                window.removeEventListener(eventName, handleUserActivity);
            }
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, [enabled, timeoutSeconds]);
}

export default useSessionIdleTimeout;
