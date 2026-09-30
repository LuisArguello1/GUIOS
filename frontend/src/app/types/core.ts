/**
 * Core System Types
 * 
 * Centralización de interfaces para navegación, organización y preferencias.
 */

export interface MenuModule {
    id: number | string;
    label: string;
    icon: string;
    path: string;
    order: number;
    is_active: boolean;
}

export interface MenuGroup {
    id: number | string;
    name: string;
    order: number;
    icon?: string;
    modules: MenuModule[];
}

export interface SidebarPrefs {
    is_collapsed: boolean;
    theme: 'dark' | 'light';
}

export interface Organization {
    id: number | string;
    name: string;
    ruc?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
    slogan?: string;
    customer_portal_active?: boolean;
    sidebar_preferences: SidebarPrefs;
}
