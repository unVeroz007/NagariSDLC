import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import ProjectList from '../pages/projects/ProjectList';
import ProjectNew from '../pages/projects/ProjectNew';
import Documents from '../pages/projects/Documents';
import WorkspaceLead from '../pages/workspace/WorkspaceLead';
import WorkspaceAnalyst from '../pages/workspace/WorkspaceAnalyst';
import Allocation from '../pages/pm/Allocation';
import Kanban from '../pages/pm/Kanban';
import Task from '../pages/pm/Tasks';
import TaskDetail from '../pages/pm/TaskDetail';
import QARequest from '../pages/pm/QARequest';
import WorkspaceQA from '../pages/workspace/WorkspaceQA';
import MyTasksQA from '../pages/mytasks/MyTasksQA';
import MyTasksCyber from '../pages/mytasks/MyTasksCyber';
import WorkspaceCyber from '../pages/workspace/WorkspaceCyber';
import CyberRequest from '../pages/pm/CyberRequest';
import ReleaseRequest from '../pages/pm/ReleaseRequest';
import QualityGate from '../pages/QualityGate';
import Users from '../pages/admin/Users';
import AuditTrail from '../pages/admin/AuditTrail';
import Analytics from '../pages/admin/Analytics';
import Settings from '../pages/admin/settings';
import Track from '../pages/Track';
import Queue from '../pages/Queue';
import Profile from '../pages/Profile';


const router = createBrowserRouter([
    {
        path: '/login',
        element: <Login />,
    },
    {
        element: <MainLayout />,
        children: [
            {
                // index: true,
                path: '/Dashboard',
                element: <Dashboard />,
            },
            {
                path: '/projects',
                element: <ProjectList />,
            },
            {
                path: '/projects/new',
                element: <ProjectNew />,
            },
            {
                path: '/Documents',
                element: <Documents />,
            },
            {
                path: '/workspace/lead',
                element: <WorkspaceLead />,
            },
            {
                path: '/workspace/analyst',
                element: <WorkspaceAnalyst />,
            },
            {
                path: '/pm/allocation',
                element: <Allocation />,
            },
            {
                path: '/pm/kanban',
                element: <Kanban />,
            },
            {
                path: '/newProject',
                element: <Navigate to="/projects/new" replace />,
            },
            {
                path: '/pm/tasks',
                element: <Task />,
            },
            {
                path: '/pm/tasks/:id',
                element: <TaskDetail />,
            },
            {
                path: '/pm/qa-request',
                element: <QARequest />,
            },
            {
                path: '/workspace/qa',
                element: <WorkspaceQA />,
            },
            {
                path: '/my-tasks/qa',
                element: <MyTasksQA />
            },
            {
                path: '/pm/cyber-request',
                element: <CyberRequest />
            },
            {
                path: '/my-tasks/cyber',
                element: <MyTasksCyber />
            },
            {
                path: '/workspace/cyber',
                element: <WorkspaceCyber />
            },
            {
                path: 'pm/release-request',
                element: <ReleaseRequest />
            },
            {
                path: '/quality-gate',
                element: <QualityGate />
            },
            {
                path: '/admin/users',
                element: <Users />
            },
            {
                path: '/admin/audit',
                element: <AuditTrail />
            },
            {
                path: '/analytics',
                element: <Analytics />
            },
            {
                path: '/admin/settings',
                element: <Settings />
            },
            {
                path: '/Track',
                element: <Track />
            },
            {
                path: '/Queue',
                element: <Queue />
            },
            {
                path: '/profile',
                element: <Profile />
            }
            // Tambahkan route lain nanti
        ],
    },
]);

export default router;