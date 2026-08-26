import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import PublicRoute from '../components/PublicRoute';

// Auth pages (public)
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import Unauthorized from '../pages/Unauthorized';
import NotFound from '../pages/NotFound';
import ExternalUatApproval from '../pages/ExternalUatApproval';
import MyApprovals from '../pages/approvals/MyApprovals';

// Main pages
import Dashboard from '../pages/Dashboard';
import Profile from '../pages/Profile';
import Track from '../pages/Track';
import Queue from '../pages/Queue';

// Project pages
import ProjectList from '../pages/projects/ProjectList';
import ProjectNew from '../pages/projects/ProjectNew';
import Documents from '../pages/projects/Documents';

// Workspace pages
import WorkspaceLead from '../pages/workspace/WorkspaceLead';
import WorkspaceAnalyst from '../pages/workspace/WorkspaceAnalyst';
import WorkspaceDevLead from '../pages/workspace/WorkspaceDevLead';
import WorkspaceDevAnalyst from '../pages/workspace/WorkspaceDevAnalyst';
import WorkspaceQA from '../pages/workspace/WorkspaceQA';
import WorkspaceCyber from '../pages/workspace/WorkspaceCyber';

// PM pages
import PMWorkspace from '../pages/pm/PMWorkspace';
import ProjectTracker from '../pages/pm/ProjectTracker';
import Allocation from '../pages/pm/Allocation';
import Kanban from '../pages/pm/Kanban';
import TaskDetail from '../pages/pm/TaskDetail';
import QARequest from '../pages/pm/QARequest';
import CyberRequest from '../pages/pm/CyberRequest';
import ReviewDocs from '../pages/pm/ReviewDocs';
import ReleaseRequest from '../pages/pm/ReleaseRequest';
import ReturnRounds from '../pages/pm/ReturnRounds';

// My Tasks pages
import MyTasksQA from '../pages/mytasks/MyTasksQA';
import MyTasksCyber from '../pages/mytasks/MyTasksCyber';
import MyTasksDev from '../pages/mytasks/MyTasksDev';

// Admin pages
import Users from '../pages/admin/Users';
import Divisions from '../pages/admin/Divisions';
import Groups from '../pages/admin/Groups';
import Roles from '../pages/admin/Roles';
import Analytics from '../pages/admin/Analytics';
import Settings from '../pages/admin/Settings';
import ActivityLog from '../pages/admin/ActivityLog';

// Other pages
import QualityGate from '../pages/QualityGate';

import { PLANNING_QA_PAGE_ROLES } from '../constants/roles';

// Role constants
const ALL_ROLES = ['super_admin', 'lead_group', 'analyst', 'development_lead', 'project_manager', 'qa_lead', 'qa_tester', 'cyber_team', 'developer', 'business_user', 'cyber_lead', 'pentester', 'head_of_it', 'dev_analyst'];
const PM_ROLES = ['super_admin', 'dev_analyst', 'project_manager', 'development_lead'];
const LEAD_ROLES = ['super_admin', 'lead_group'];
const DEV_LEAD_ROLES = ['super_admin', 'development_lead'];
const DEV_MEMBER_ROLES = ['super_admin', 'development_lead', 'developer', 'dev_analyst', 'project_manager'];
const CYBER_ROLES = ['super_admin', 'cyber_team', 'cyber_lead', 'pentester'];
const ADMIN_ROLES = ['super_admin'];
// Role yang boleh menginisiasi & melacak pengajuan proyek
const BUSINESS_ROLES = ['super_admin', 'head_of_it', 'business_user'];
// Role yang boleh mengelola dokumen (upload/hapus)
const DOC_MANAGEMENT_ROLES = ['super_admin', 'head_of_it', 'lead_group', 'project_manager', 'dev_analyst', 'development_lead'];
// Role yang boleh membuka detail proyek (TaskDetail): PM + viewer (developer/analyst read-only)
const TASK_DETAIL_ROLES = ['super_admin', 'head_of_it', 'lead_group', 'dev_analyst', 'project_manager', 'development_lead', 'developer', 'analyst'];
const INTERNAL_UAT_APPROVER_ROLES = ['super_admin', 'head_of_it', 'lead_group', 'analyst', 'development_lead', 'project_manager', 'dev_analyst', 'developer'];
// Role yang boleh membuka halaman Putaran Pengembalian. Dibuat tersendiri karena tidak
// ada konstanta lain yang menyatukan sisi pengembangan dengan kedua Lead pengujian:
// PM/Analis Pengembangan menindak putarannya, sementara Lead Pengembangan, developer,
// Lead QA, dan Lead Keamanan Siber perlu membaca temuan yang dikembalikan tanpa hak
// mengubahnya. Pembatasan aksinya sendiri ada di halaman (kepemilikan `pm_id`).
const RETURN_ROUND_PAGE_ROLES = ['super_admin', 'project_manager', 'dev_analyst', 'development_lead', 'developer', 'qa_lead', 'cyber_lead'];

const router = createBrowserRouter([
    // ─────────────────────────────────────────────
    // Halaman publik (hanya bisa dibuka jika BELUM login)
    // ─────────────────────────────────────────────
    {
        path: '/',
        element: <Navigate to="/login" replace />,
    },
    {
        path: '/login',
        element: (
            <PublicRoute>
                <Login />
            </PublicRoute>
        ),
    },
    {
        path: '/register',
        element: (
            <PublicRoute>
                <Register />
            </PublicRoute>
        ),
    },
    {
        path: '/forgot-password',
        element: (
            <PublicRoute>
                <ForgotPassword />
            </PublicRoute>
        ),
    },
    {
        path: '/reset-password',
        element: (
            <PublicRoute>
                <ResetPassword />
            </PublicRoute>
        ),
    },
    {
        path: '/unauthorized',
        element: <Unauthorized />,
    },
    {
        path: '/uat-approval/:token',
        element: <ExternalUatApproval />,
    },
    {
        path: '*',
        element: <NotFound />,
    },

    // ─────────────────────────────────────────────
    // Halaman yang memerlukan login (semua role)
    // ─────────────────────────────────────────────
    {
        element: (
            <ProtectedRoute allowedRoles={ALL_ROLES}>
                <MainLayout />
            </ProtectedRoute>
        ),
        children: [
            // UTAMA
            {
                path: '/dashboard',
                element: (
                    <ProtectedRoute allowedRoles={['super_admin', 'head_of_it']}>
                        <Dashboard />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/profile',
                element: <Profile />,
            },
            {
                path: '/approvals',
                element: (
                    <ProtectedRoute allowedRoles={INTERNAL_UAT_APPROVER_ROLES}>
                        <MyApprovals />
                    </ProtectedRoute>
                ),
            },
            {
                // Halaman ini dulu hanya memuat persetujuan UAT. Jalur lamanya
                // dipertahankan sebagai pengalihan karena masih dipakai penanda balik
                // `from=uat-approvals` di `TaskDetail` dan tautan yang sudah tersimpan
                // pengguna.
                path: '/approvals/uat',
                element: <Navigate to="/approvals" replace />,
            },
            {
                path: '/projects',
                element: <ProjectList />,
            },
            {
                path: '/documents',
                element: (
                    <ProtectedRoute allowedRoles={DOC_MANAGEMENT_ROLES}>
                        <Documents />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/track',
                element: (
                    <ProtectedRoute allowedRoles={BUSINESS_ROLES}>
                        <Track />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/queue',
                element: (
                    <ProtectedRoute allowedRoles={['super_admin', 'lead_group']}>
                        <Queue />
                    </ProtectedRoute>
                ),
            },

            // FASE 1 – Inisiasi & Review
            {
                path: '/projects/new',
                element: (
                    <ProtectedRoute allowedRoles={BUSINESS_ROLES}>
                        <ProjectNew />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/newProject',
                element: <Navigate to="/projects/new" replace />,
            },
            {
                path: '/workspace/lead',
                element: (
                    <ProtectedRoute allowedRoles={LEAD_ROLES}>
                        <WorkspaceLead />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/workspace/analyst',
                element: (
                    <ProtectedRoute allowedRoles={PLANNING_QA_PAGE_ROLES}>
                        <WorkspaceAnalyst />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/workspace/dev-lead',
                element: (
                    <ProtectedRoute allowedRoles={DEV_LEAD_ROLES}>
                        <WorkspaceDevLead />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/workspace/dev-analyst',
                element: (
                    <ProtectedRoute allowedRoles={[...PM_ROLES]}>
                        <WorkspaceDevAnalyst />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/my-tasks/dev',
                element: (
                    <ProtectedRoute allowedRoles={DEV_MEMBER_ROLES}>
                        <MyTasksDev />
                    </ProtectedRoute>
                ),
            },

            // FASE 2 – Pengembangan
            {
                path: '/pm/workspace',
                element: (
                    <ProtectedRoute allowedRoles={PM_ROLES}>
                        <PMWorkspace />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/tracker',
                element: (
                    <ProtectedRoute allowedRoles={[...PM_ROLES, 'super_admin']}>
                        <ProjectTracker />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/allocation',
                element: (
                    <ProtectedRoute allowedRoles={PM_ROLES}>
                        <Allocation />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/kanban',
                element: (
                    <ProtectedRoute allowedRoles={DEV_MEMBER_ROLES}>
                        <Kanban />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/tasks',
                element: <Navigate to="/pm/workspace" replace />,
            },
            {
                path: '/pm/tasks/:id',
                element: (
                    <ProtectedRoute allowedRoles={TASK_DETAIL_ROLES}>
                        <TaskDetail />
                    </ProtectedRoute>
                ),
            },

            // FASE 3 – Pengujian
            {
                path: '/pm/qa-request',
                element: (
                    <ProtectedRoute allowedRoles={PM_ROLES}>
                        <QARequest />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/workspace/qa',
                element: (
                    <ProtectedRoute allowedRoles={PLANNING_QA_PAGE_ROLES}>
                        <WorkspaceQA />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/my-tasks/qa',
                element: (
                    <ProtectedRoute allowedRoles={PLANNING_QA_PAGE_ROLES}>
                        <MyTasksQA />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/cyber-request',
                element: (
                    <ProtectedRoute allowedRoles={PM_ROLES}>
                        <CyberRequest />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/workspace/cyber',
                element: (
                    <ProtectedRoute allowedRoles={CYBER_ROLES}>
                        <WorkspaceCyber />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/my-tasks/cyber',
                element: (
                    <ProtectedRoute allowedRoles={CYBER_ROLES}>
                        <MyTasksCyber />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/return-rounds',
                element: (
                    <ProtectedRoute allowedRoles={RETURN_ROUND_PAGE_ROLES}>
                        <ReturnRounds />
                    </ProtectedRoute>
                ),
            },

            // FASE 4 – Rilis & Kepatuhan
            {
                path: '/pm/review-docs',
                element: (
                    <ProtectedRoute allowedRoles={PM_ROLES}>
                        <ReviewDocs />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/pm/release-request',
                element: (
                    <ProtectedRoute allowedRoles={PM_ROLES}>
                        <ReleaseRequest />
                    </ProtectedRoute>
                ),
            },
            {
        path: '/quality-gate',
        element: (
            <ProtectedRoute allowedRoles={['super_admin', 'head_of_it']}>
                <QualityGate />
            </ProtectedRoute>
        ),
    },

            // ADMINISTRASI
            {
                path: '/admin/users',
                element: (
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <Users />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/divisions',
                element: (
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <Divisions />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/groups',
                element: (
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <Groups />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/roles',
                element: (
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <Roles />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/activity-log',
                element: (
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <ActivityLog />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/audit',
                element: <Navigate to="/admin/activity-log" replace />,
            },
            {
                path: '/analytics',
                element: (
                    <ProtectedRoute allowedRoles={['super_admin', 'head_of_it']}>
                        <Analytics />
                    </ProtectedRoute>
                ),
            },
            {
                path: '/admin/settings',
                element: (
                    <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                        <Settings />
                    </ProtectedRoute>
                ),
            },
        ],
    },
]);

export default router;
