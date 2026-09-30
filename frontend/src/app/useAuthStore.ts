import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: number | string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    avatar?: string | null;
    is_staff: boolean;
    is_superuser: boolean;

    // Nuevos permisos RBAC
    permissions?: string[];
}

interface Group {
    id: number | string;
    name: string;
    [key: string]: unknown;
}

type PersistedAuthState = Pick<
    AuthState,
    'user' | 'groups' | 'selectedGroup' | 'isAuthenticated' | 'sessionJti'
> & {
    tokens?: unknown;
};

const EMPTY_PERSISTED_AUTH_STATE: PersistedAuthState = {
    user: null,
    groups: [],
    selectedGroup: null,
    isAuthenticated: false,
    sessionJti: '',
};

const isPersistedAuthState = (value: unknown): value is PersistedAuthState =>
    typeof value === 'object' && value !== null;


interface AuthState {
    user: User | null;
    groups: Group[];
    selectedGroup: Group | null;
    isAuthenticated: boolean;
    sessionJti: string;

    loginSuccess: (authData: {
        user: User;
        groups: Group[];
        session_jti?: string;
    }) => { requires_selection: boolean };
    setRole: (group: Group) => void;
    setGroups: (groups: Group[]) => void;
    setUser: (userData: Partial<User>) => void;
    logout: () => void;
}

const normalizePermissionFields = <T extends Partial<User> | null>(user: T): T => {
    if (!user) return user;
    return {
        ...user,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
    };
};

const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            groups: [],
            selectedGroup: null,
            isAuthenticated: false,
            sessionJti: '',
            requiresTermsAcceptance: false,

            loginSuccess: (authData) => {
                const { user, groups, session_jti } = authData;
                const normalizedUser = normalizePermissionFields(user);

                const defaultRole = groups.length === 1 ? groups[0] : null;

                set({
                    user: normalizedUser,
                    groups,
                    isAuthenticated: true,
                    selectedGroup: defaultRole,
                    sessionJti: session_jti || '',
                });

                return { requires_selection: groups.length > 1 };
            },

            setRole: (group: Group) => set({ selectedGroup: group }),

            setGroups: (groups: Group[]) => set({ groups }),

            setUser: (userData: Partial<User>) => set((state) => ({
                user: normalizePermissionFields(
                    state.user ? ({ ...state.user, ...userData } as User) : (userData as User)
                ),
            })),

            logout: () => {
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                }

                set({
                    user: null,
                    groups: [],
                    selectedGroup: null,
                    isAuthenticated: false,
                    sessionJti: '',
                });
            },

            setTermsAccepted: (version: string) => set((state) => ({
                requiresTermsAcceptance: false,
                user: state.user
                    ? { ...state.user, terms_accepted: true, terms_version: version }
                    : null,
            })),
        }),
        {
            name: 'auth-storage',
            version: 2,
            migrate: (persistedState: unknown, version: number): PersistedAuthState => {
                if (!isPersistedAuthState(persistedState)) {
                    return EMPTY_PERSISTED_AUTH_STATE;
                }

                if (version < 2) {
                    const { tokens, ...cleanState } = persistedState as PersistedAuthState & {
                        tokens?: unknown;
                    };
                    void tokens;
                    return cleanState as PersistedAuthState;
                }

                return persistedState;
            },
            partialize: (state) => ({
                user: state.user,
                groups: state.groups,
                selectedGroup: state.selectedGroup,
                isAuthenticated: state.isAuthenticated,
                sessionJti: state.sessionJti,
            }),
        }
    )
);

if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
}

export default useAuthStore;
