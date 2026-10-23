import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';
import ModuleGuard from './components/layouts/ModuleGuard';
import Loading from './components/ui/Loading';
import ToastProvider from './components/ui/ToastProvider';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const PasswordRecoveryPage = lazy(() => import('./features/auth/PasswordRecoveryPage'));
const RoleSelectionPage = lazy(() => import('./features/auth/RoleSelectionPage'));
const NoRolePage = lazy(() => import('./features/auth/NoRolePage'));

const HomePage = lazy(() => import('./features/evaluation/pages/HomePage'));
const StationPage = lazy(() => import('./features/evaluation/pages/StationPage'));
const ResultsPage = lazy(() => import('./features/evaluation/pages/ResultsPage'));

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('./features/dashboard/ProfilePage'));
const UsersPage = lazy(() => import('./features/users/UsersPage'));
const AuditPage = lazy(() => import('./features/audit/AuditPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const RolesPermissonsPage = lazy(() => import('./features/settings/pages/RolesPermissonsPage'));
const OrganizationPage = lazy(() => import('./features/settings/pages/OrganizationPage'));
const MenuSettingsPage = lazy(() => import('./features/settings/pages/MenuSettingsPage'));
const CatalogPage = lazy(() => import('./features/catalog/CatalogPage'));
const EvaluationsPage = lazy(() => import('./features/evaluations/EvaluationsPage'));
const EvaluationDetailPage = lazy(() => import('./features/evaluations/EvaluationDetailPage'));

function App() {
    return (
        <>
            <ToastProvider />

            <Suspense fallback={<Loading fullPage label="Sincronizando..." />}>
                <Routes>
                    {/* Evaluación pública (sin sesión), fuera de /dashboard */}
                    <Route element={<PublicLayout />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/evaluacion/:uuid" element={<StationPage />} />
                        <Route path="/evaluacion/:uuid/resultados" element={<ResultsPage />} />
                    </Route>

                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/recuperar-contrasena" element={<PasswordRecoveryPage />} />
                    <Route path="/select-role" element={<RoleSelectionPage />} />
                    <Route path="/no-role" element={<NoRolePage />} />

                    <Route path="/dashboard" element={<MainLayout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="perfil" element={<ProfilePage />} />
                        <Route
                            path="users"
                            element={
                                <ModuleGuard requiredPath="/dashboard/users">
                                    <UsersPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="auditoria"
                            element={
                                <ModuleGuard requiredPath="/dashboard/auditoria">
                                    <AuditPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="catalogo"
                            element={
                                <ModuleGuard requiredPath="/dashboard/catalogo">
                                    <CatalogPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="evaluaciones"
                            element={
                                <ModuleGuard requiredPath="/dashboard/evaluaciones">
                                    <EvaluationsPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="evaluaciones/:uuid"
                            element={
                                <ModuleGuard requiredPath="/dashboard/evaluaciones">
                                    <EvaluationDetailPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="configuracion/*"
                            element={
                                <ModuleGuard requiredPath="/dashboard/configuracion">
                                    <SettingsPage />
                                </ModuleGuard>
                            }
                        >
                            <Route index element={<Navigate to="permisos" replace />} />
                            <Route path="organizacion" element={<OrganizationPage />} />
                            <Route path="permisos" element={<RolesPermissonsPage />} />
                            <Route path="menu" element={<MenuSettingsPage />} />
                            <Route path="perfil" element={<ProfilePage />} />
                            <Route path="*" element={<Navigate to="permisos" replace />} />
                        </Route>
                        <Route
                            path="*"
                            element={
                                <div className="flex h-full flex-col items-center justify-center p-20 text-center opacity-30">
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Módulo no encontrado</p>
                                </div>
                            }
                        />
                    </Route>

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Suspense>
        </>
    );
}

export default App;
