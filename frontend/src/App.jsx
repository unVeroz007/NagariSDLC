import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { ChatProvider } from './contexts/ChatContext';
import { MasterDataProvider } from './contexts/MasterDataContext';
import ErrorBoundary from './components/ErrorBoundary';
import router from './router';
import { Toaster } from 'react-hot-toast';

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <NotificationProvider>
                    <ProjectProvider>
                        <ActivityProvider>
                            <MasterDataProvider>
                                <ChatProvider>
                                    <Toaster position="top-right" />
                                    <RouterProvider router={router} />
                                </ChatProvider>
                            </MasterDataProvider>
                        </ActivityProvider>
                    </ProjectProvider>
                </NotificationProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;