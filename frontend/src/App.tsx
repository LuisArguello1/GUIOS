import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import MainLayout from './layouts/MainLayout';
import ModuleGuard from './components/layouts/ModuleGuard';
import Loading from './components/ui/Loading';
import ToastProvider from './components/ui/ToastProvider';

const LoginPage = lazy(() => import('./features/auth/LoginPage'));
const PasswordRecoveryPage = lazy(() => import('./features/auth/PasswordRecoveryPage'));
const RoleSelectionPage = lazy(() => import('./features/auth/RoleSelectionPage'));
const NoRolePage = lazy(() => import('./features/auth/NoRolePage'));

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('./features/dashboard/ProfilePage'));
const UsersPage = lazy(() => import('./features/users/UsersPage'));
const AuditPage = lazy(() => import('./features/audit/AuditPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const RolesPermissonsPage = lazy(() => import('./features/settings/pages/RolesPermissonsPage'));
const OrganizationPage = lazy(() => import('./features/settings/pages/OrganizationPage'));
const MenuSettingsPage = lazy(() => import('./features/settings/pages/MenuSettingsPage'));
const DimensionsPage = lazy(() => import('./features/guios/dimensions/DimensionsPage'));
const FactorsPage = lazy(() => import('./features/guios/factors/FactorsPage'));
const EvaluationsPage = lazy(() => import('./features/guios/evaluations/EvaluationsPage'));
const EvaluationDetailPage = lazy(() => import('./features/guios/evaluations/EvaluationDetailPage'));
const EvaluationComparePage = lazy(() => import('./features/guios/evaluations/EvaluationComparePage'));
const PublicEvaluationPage = lazy(() => import('./features/publicEvaluation/PublicEvaluationPage'));
const LandingPage = lazy(() => import('./features/landing/LandingPage'));

function App() {
    return (
        <>
            <ToastProvider />

            <Suspense fallback={<Loading fullPage label="Sincronizando..." />}>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/recuperar-contrasena" element={<PasswordRecoveryPage />} />
                    <Route path="/select-role" element={<RoleSelectionPage />} />
                    <Route path="/no-role" element={<NoRolePage />} />

                    <Route path="/dashboard" element={<MainLayout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="perfil" element={<ProfilePage />} />
                        <Route
                            path="guios/dimensiones"
                            element={
                                <ModuleGuard requiredPath="/dashboard/guios/dimensiones">
                                    <DimensionsPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="guios/factores"
                            element={
                                <ModuleGuard requiredPath="/dashboard/guios/factores">
                                    <FactorsPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="guios/evaluaciones"
                            element={
                                <ModuleGuard requiredPath="/dashboard/guios/evaluaciones">
                                    <EvaluationsPage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="guios/evaluaciones/comparar"
                            element={
                                <ModuleGuard requiredPath="/dashboard/guios/evaluaciones">
                                    <EvaluationComparePage />
                                </ModuleGuard>
                            }
                        />
                        <Route
                            path="guios/evaluaciones/:id"
                            element={
                                <ModuleGuard requiredPath="/dashboard/guios/evaluaciones">
                                    <EvaluationDetailPage />
                                </ModuleGuard>
                            }
                        />
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

                    {/* Portal Institucional Principal: Landing Page Editorial de Lujo */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/landing" element={<LandingPage />} />

                    {/* Módulo Público de Evaluación Técnica GUIOS PRO */}
                    <Route path="/evaluar" element={<PublicEvaluationPage />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </>
    );
}

export default App;
