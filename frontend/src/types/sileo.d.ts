import type { ReactNode } from 'react';

declare module 'sileo' {
    export type SileoPosition =
        | 'top-left'
        | 'top-center'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-center'
        | 'bottom-right';

    export type SileoState =
        | 'success'
        | 'loading'
        | 'error'
        | 'warning'
        | 'info'
        | 'action';

    export interface SileoStyles {
        title?: string;
        description?: string;
        badge?: string;
        button?: string;
    }

    export interface SileoButton {
        title: string;
        onClick: () => void;
    }

    export interface SileoToastOptions {
        title?: string;
        description?: ReactNode | string;
        duration?: number;
        type?: SileoState;
        position?: SileoPosition;
        icon?: ReactNode | null;
        styles?: SileoStyles;
        fill?: string;
        roundness?: number;
        autopilot?: boolean | { expand?: number; collapse?: number };
        button?: SileoButton;
    }

    export interface SileoToasterProps {
        children?: ReactNode;
        position?: SileoPosition;
        offset?: number | string | Partial<Record<'top' | 'right' | 'bottom' | 'left', number | string>>;
        options?: Partial<SileoToastOptions>;
        theme?: 'light' | 'dark' | 'system';
    }

    export interface SileoApi {
        success: (options: SileoToastOptions) => void;
        error: (options: SileoToastOptions) => void;
        warning: (options: SileoToastOptions) => void;
        info: (options: SileoToastOptions) => void;
        show: (options: SileoToastOptions) => void;
        dismiss: (id: string) => void;
        clear: (position?: SileoPosition) => void;
    }

    export const sileo: SileoApi;
    export const Toaster: (props: SileoToasterProps) => ReactNode;
}
