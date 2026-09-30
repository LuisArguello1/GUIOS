/**
 * Centralized API endpoints for the application.
 * All paths follow the Django Rest Framework convention (with trailing slashes).
 */

export const ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login/',
        LOGOUT: '/auth/logout/',
        RESET_REQUEST: '/password-reset/request/',
        RESET_VERIFY: '/password-reset/verify/',
        RESET_CONFIRM: '/password-reset/confirm/',
        VERIFY_2FA: '/auth/login/verify-2fa/',
        TOTP_CONFIG: '/auth/2fa/config/',
        TOTP_ACTIVATE: '/auth/2fa/activate/',
        TOTP_DEACTIVATE: '/auth/2fa/deactivate/',
        TOTP_REGENERATE_CODES: '/auth/2fa/regenerate-codes/',
        TOTP_EXPORT_PDF: '/auth/2fa/export-pdf/',
    },
    USERS: {
        BASE: '/users/',
        ME: '/users/me/',
        SELECTORS: '/users/selectors/',
        CHANGE_PASSWORD: '/users/change-password/',
        DETAIL: (id: string | number) => `/users/${id}/`,
        TOGGLE_ACTIVE: (id: string | number) => `/users/${id}/toggle-active/`,
    },
    AUDIT: {
        LOGS: '/audit/logs/',
        MODELS: '/audit/logs/models/',
        DETAIL: (id: string | number) => `/audit/logs/${id}/`,
    },
    CORE: {
        MENU: '/core/menu/',
        MENU_TREE: '/core/menu/tree/',
        PERMISSION_TREE: '/core/permission-tree/',
        ORGANIZATION: '/core/organization/',
        UPDATE_ORG: '/core/organization/update/',
        GROUPS: {
            BASE: '/core/groups/',
            DETAIL: (id: string | number) => `/core/groups/${id}/`,
            UPDATE_MODULES: (id: string | number) => `/core/groups/${id}/update-modules/`,
            UPDATE_PERMISSIONS: (id: string | number) => `/core/groups/${id}/update-permissions/`,
        },
        MENU_CATEGORIES: {
            BASE: '/core/menu-categories/',
            DETAIL: (id: string | number) => `/core/menu-categories/${id}/`,
            REORDER: '/core/menu-categories/reorder/',
        },
        MENU_MODULES: {
            BASE: '/core/menu-modules/',
            DETAIL: (id: string | number) => `/core/menu-modules/${id}/`,
            REORDER: '/core/menu-modules/reorder/',
        },
        DASHBOARD: '/core/dashboard/',
    },
};

export default ENDPOINTS;
