import api from './axios';
import { ENDPOINTS } from './endpoints';

interface LoginResponse {
    detail: string;
    user: {
        id: number;
        email: string;
        username: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        avatar: string | null;
        is_staff: boolean;
        is_superuser: boolean;
    };
    groups: Array<{ id: number | string; name: string; [key: string]: unknown }>;
    // Soporte para 2FA
    requires_2fa?: boolean;
    pre_auth_token?: string;
    // Soporte para aceptación de términos
    requires_terms_acceptance?: boolean;
    session_idle_timeout_seconds?: number;
}

interface TOTPConfigResponse {
    uri: string | null;
    is_active: boolean;
    secret?: string;
}

interface OTPResponse {
    detail: string;
    recovery_codes?: string[];
}

interface OTPVerifyResponse {
    detail: string;
    verified: boolean;
}

export type ProfileUpdatePayload = {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string | null;
    avatar?: File | null;
} | FormData;

const isFormDataPayload = (payload: ProfileUpdatePayload): payload is FormData => {
    return typeof FormData !== 'undefined' && payload instanceof FormData;
};

const authService = {
    login: async (email: string, password: string): Promise<LoginResponse> => {
        const response = await api.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, { email, password });
        return response.data;
    },

    logout: async (): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.AUTH.LOGOUT);
        return response.data;
    },

    updateProfile: async (payload: ProfileUpdatePayload): Promise<LoginResponse['user']> => {
        if (isFormDataPayload(payload)) {
            const response = await api.patch<LoginResponse['user']>(ENDPOINTS.USERS.ME, payload, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        }

        if (payload.avatar instanceof File) {
            const formData = new FormData();
            Object.entries(payload).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                if (value instanceof File) {
                    formData.append(key, value);
                    return;
                }
                formData.append(key, String(value));
            });

            const response = await api.patch<LoginResponse['user']>(ENDPOINTS.USERS.ME, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        }

        const response = await api.patch<LoginResponse['user']>(ENDPOINTS.USERS.ME, payload);
        return response.data;
    },

    getCurrentUser: async (options?: { background?: boolean }): Promise<LoginResponse['user']> => {
        const response = await api.get<LoginResponse['user']>(ENDPOINTS.USERS.ME, {
            params: options?.background ? { background: 1 } : undefined,
        });
        return response.data;
    },

    requestResetOTP: async (email: string): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.AUTH.RESET_REQUEST, { email });
        return response.data;
    },

    verifyResetOTP: async (email: string, code: string): Promise<OTPVerifyResponse> => {
        const response = await api.post<OTPVerifyResponse>(ENDPOINTS.AUTH.RESET_VERIFY, {
            email,
            code,
        });
        return response.data;
    },

    confirmPasswordReset: async (
        email: string,
        code: string,
        passwordData: { new_password: string; confirm_password: string }
    ): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.AUTH.RESET_CONFIRM, {
            email,
            code,
            ...passwordData,
        });
        return response.data;
    },

    // ── Autenticación de Doble Factor (2FA) ──────────────────────────────────
    
    verify2FA: async (pre_auth_token: string, code: string): Promise<LoginResponse> => {
        const response = await api.post<LoginResponse>(ENDPOINTS.AUTH.VERIFY_2FA, {
            pre_auth_token,
            code,
        });
        return response.data;
    },

    getTOTPConfig: async (): Promise<TOTPConfigResponse> => {
        const response = await api.get<TOTPConfigResponse>(ENDPOINTS.AUTH.TOTP_CONFIG);
        return response.data;
    },

    activateTOTP: async (code: string): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.AUTH.TOTP_ACTIVATE, { code });
        return response.data;
    },

    deactivateTOTP: async (password: string): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.AUTH.TOTP_DEACTIVATE, { password });
        return response.data;
    },

    regenerateTOTPCodes: async (password: string): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.AUTH.TOTP_REGENERATE_CODES, { password });
        return response.data;
    },

    exportRecoveryCodesPDF: async (codes: string[]): Promise<Blob> => {
        const response = await api.post(ENDPOINTS.AUTH.TOTP_EXPORT_PDF, { codes }, {
            responseType: 'blob'
        });
        return response.data;
    },

    changePassword: async (data: {
        old_password: string;
        new_password: string;
        confirm_password: string;
        otp_code?: string;
    }): Promise<OTPResponse> => {
        const response = await api.post<OTPResponse>(ENDPOINTS.USERS.CHANGE_PASSWORD, data);
        return response.data;
    },

};

export default authService;
