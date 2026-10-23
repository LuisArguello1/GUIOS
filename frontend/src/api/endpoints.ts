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
    GUIOS_ADMIN: {
        CATALOG_TREE: '/guios/admin/catalog/tree/',
        DIMENSIONS: '/guios/admin/dimensions/',
        DIMENSION: (id: number) => `/guios/admin/dimensions/${id}/`,
        FACTORS: '/guios/admin/factors/',
        FACTOR: (id: number) => `/guios/admin/factors/${id}/`,
        SUBFACTORS: '/guios/admin/subfactors/',
        SUBFACTOR: (id: number) => `/guios/admin/subfactors/${id}/`,
        EVALUATIONS: '/guios/admin/evaluations/',
        EVALUATION: (uuid: string) => `/guios/admin/evaluations/${uuid}/`,
        EXPORT_CSV: '/guios/admin/evaluations/export/csv/',
        EXPORT_PDF: (uuid: string) => `/guios/admin/evaluations/${uuid}/export/pdf/`,
        METRICS: '/guios/admin/metrics/',
    },
    GUIOS_PUBLIC: {
        CATALOG: '/guios/public/catalog/',
        EVALUATIONS: '/guios/public/evaluations/',
        EVALUATION: (uuid: string) => `/guios/public/evaluations/${uuid}/`,
        SUMMARY: (uuid: string) => `/guios/public/evaluations/${uuid}/summary/`,
        FACTOR: (uuid: string, factorId: number) => `/guios/public/evaluations/${uuid}/factors/${factorId}/`,
        SUBFACTOR: (uuid: string, subfactorId: number) => `/guios/public/evaluations/${uuid}/subfactors/${subfactorId}/`,
        VERDICT: (uuid: string) => `/guios/public/evaluations/${uuid}/verdict/`,
        DUPLICATE: (uuid: string) => `/guios/public/evaluations/${uuid}/duplicate/`,
    },
};

export default ENDPOINTS;
