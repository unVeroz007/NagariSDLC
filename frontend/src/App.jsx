// src/App.jsx
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ActivityProvider } from './contexts/ActivityContext';
import router from './router';
import { Toaster } from 'react-hot-toast';

function App() {
    return (
        <AuthProvider>
            <NotificationProvider>
                <ProjectProvider>
                    <ActivityProvider>
                        <Toaster position="top-right" />
                        <RouterProvider router={router} />
                    </ActivityProvider>
                </ProjectProvider>
            </NotificationProvider>
        </AuthProvider>
    );
}

export default App;