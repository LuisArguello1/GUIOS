import { render, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionIdleTimeout } from './useSessionIdleTimeout';

interface HarnessProps {
    enabled: boolean;
    timeoutSeconds: number;
    onIdleLogout: () => void;
}

function IdleHarness({ enabled, timeoutSeconds, onIdleLogout }: HarnessProps) {
    useSessionIdleTimeout({ enabled, timeoutSeconds, onIdleLogout });
    return null;
}

describe('useSessionIdleTimeout', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('extends deadline on user activity and triggers logout after inactivity period', () => {
        const onIdleLogout = vi.fn();

        render(<IdleHarness enabled={true} timeoutSeconds={60} onIdleLogout={onIdleLogout} />);

        act(() => {
            vi.advanceTimersByTime(45_000);
        });
        expect(onIdleLogout).not.toHaveBeenCalled();

        // Simular interacción del usuario a los 45 s
        act(() => {
            window.dispatchEvent(new MouseEvent('mousemove'));
            vi.advanceTimersByTime(45_000);
        });
        expect(onIdleLogout).not.toHaveBeenCalled();

        // Transcurren otros 30 s sin actividad (75 s >= 60 s desde la última interacción)
        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        expect(onIdleLogout).toHaveBeenCalledTimes(1);
    });
});
