import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import * as SileoModule from 'sileo';
import { ToastContainer } from 'react-toastify';
import { Toaster as HotToaster } from 'react-hot-toast';
import 'react-toastify/dist/ReactToastify.css';
import useThemeStore from '../../app/useThemeStore';
import useToastStore from '../../app/useToastStore';
import CustomToaster from './CustomToast';

type ToastSystem = 'sileo' | 'toastify' | 'hot-toast' | 'custom';
type ToastPosition =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

const TOAST_POSITIONS: ToastPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
];

const normalizeToastPosition = (value: string): ToastPosition => {
    if (TOAST_POSITIONS.includes(value as ToastPosition)) {
        return value as ToastPosition;
    }

    return 'bottom-right';
};

// INT_MAX — techo seguro de z-index
const MAX_Z = 2147483647;

type SileoToasterLike = React.ComponentType<{
    position?: ToastPosition;
    offset?: number | string;
    options?: {
        fill?: string;
        styles?: {
            title?: string;
            description?: string;
            badge?: string;
        };
    };
}>;

const SileoToaster = (SileoModule as unknown as { Toaster?: SileoToasterLike }).Toaster;

/**
 * ToastProvider
 * Renders the active notification engine into document.body via portal.
 */
const ToastProvider: React.FC = () => {
    const { theme } = useThemeStore();
    const { toastSystem, toastPosition, toastDuration } = useToastStore() as {
        toastSystem:  ToastSystem;
        toastPosition: string;
        toastDuration: number;
    };

    const isDark   = theme === 'dark';
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    /** On mobile collapse left/right variants to center. */
    const normalizedPosition = normalizeToastPosition(toastPosition);
    const resolvedPosition: ToastPosition = isMobile
        ? (normalizedPosition.includes('top') ? 'top-center' : 'bottom-center')
        : normalizedPosition;

    const sileoFill    = isDark ? '#ffffff' : '#171717';
    const sileoText    = isDark ? 'text-black'    : 'text-white';
    const sileoSubText = isDark ? 'text-black/60' : 'text-white/80';

    const content = (
        <div style={{ position: 'relative', zIndex: MAX_Z }}>

            {/* ── Engine 1: Sileo ── */}
            {toastSystem === 'sileo' && SileoToaster && (
                <SileoToaster
                    position={resolvedPosition}
                    offset={isMobile ? 12 : 24}
                    options={{
                        fill: sileoFill,
                        styles: {
                            title:       `font-semibold tracking-tight ${sileoText} text-center w-full text-xs`,
                            description: `${sileoSubText} font-medium text-[10px] text-center w-full`,
                            badge:       'shadow-[var(--shadow-sm)]',
                        },
                    }}
                />
            )}

            {/* ── Engine 2: Toastify ── */}
            {toastSystem === 'toastify' && (
                <ToastContainer
                    stacked
                    position={resolvedPosition as never}
                    autoClose={toastDuration ?? 4000}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme={isDark ? 'dark' : 'light'}
                    style={{ zIndex: MAX_Z }}
                    toastStyle={{
                        borderRadius:  'var(--radius-md)',
                        border:        '1px solid var(--color-border-subtle)',
                        background:    'var(--color-bg-elevated)',
                        color:         'var(--color-text-primary)',
                        fontSize:      isMobile ? '11px' : '13px',
                        fontFamily:    'var(--font-sans)',
                        fontWeight:    '600',
                        boxShadow:     'var(--shadow-lg)',
                        margin:        isMobile ? '4px 8px' : undefined,
                    }}
                />
            )}

            {/* ── Engine 3: Hot Toast ── */}
            {toastSystem === 'hot-toast' && (
                <HotToaster
                    position={resolvedPosition as never}
                    containerStyle={{ zIndex: MAX_Z }}
                    toastOptions={{
                        duration: toastDuration ?? 4000,
                        style: {
                            borderRadius: 'var(--radius-md)',
                            background:   'var(--color-bg-elevated)',
                            color:        'var(--color-text-primary)',
                            border:       '1px solid var(--color-border-subtle)',
                            fontSize:     isMobile ? '11px' : '13px',
                            padding:      isMobile ? '8px 12px' : '10px 14px',
                            fontFamily:   'var(--font-sans)',
                            fontWeight:   '600',
                            boxShadow:    'var(--shadow-lg)',
                        },
                    }}
                />
            )}

            {/* ── Engine 4: Custom ── */}
            {toastSystem === 'custom' && <CustomToaster />}
        </div>
    );

    return createPortal(content, document.body);
};

export default memo(ToastProvider);