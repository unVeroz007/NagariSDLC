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
            // Tambahkan route lain nanti
        ],
    },
]);

export default router;