import { defaultTheme, Provider } from '@adobe/react-spectrum'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import ErrorPage from './components/ErrorPage'
import Navigation from './components/Navigation/Navigation'
import AgentActivityMonitorDemo from './pages/AgentActivityMonitorDemo'
import AgentPerformanceDemo from './pages/AgentPerformanceDemo'
import Agents from './pages/Agents'
import ApiKeysManager from './pages/ApiKeysManager'
import ChatEnhanced from './pages/ChatEnhanced'
import ChatModern from './pages/ChatModern'
import Dashboard from './pages/Dashboard'
import Memory from './pages/Memory'
import MLXTraining from './pages/MLXTraining'
import ModelsManager from './pages/ModelsManager'
import MonitoringDashboard from './pages/MonitoringDashboard'
import OrchestrationDashboard from './pages/OrchestrationDashboard'
import TaskExecutionDemo from './pages/TaskExecutionDemo'
import VisionStudio from './pages/VisionStudio'

// Layout component with navigation - Dashboard has its own header
function DashboardLayout() {
  return <Outlet />
}

// Layout component with navigation for other pages
function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#111827', color: '#f9fafb' }}>
      <Navigation />
      <main>
        <Outlet />
      </main>
    </div>
  )
}

// Create router with future flags enabled
const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: 'chat', element: <ChatModern /> },
      { path: 'chat-classic', element: <ChatEnhanced /> },
      { path: 'vision', element: <VisionStudio /> },
      { path: 'mlx', element: <MLXTraining /> },
      { path: 'orchestration', element: <OrchestrationDashboard /> },
      { path: 'monitoring', element: <MonitoringDashboard /> },
      { path: 'models', element: <ModelsManager /> },
      { path: 'agents', element: <Agents /> },
      { path: 'memory', element: <Memory /> },
      { path: 'performance', element: <AgentPerformanceDemo /> },
      { path: 'activity', element: <AgentActivityMonitorDemo /> },
      { path: 'tasks', element: <TaskExecutionDemo /> },
      { path: 'api-keys', element: <ApiKeysManager /> },
      { path: '*', element: <ErrorPage /> },
    ],
  },
], {
  future: {
    v7_skipActionErrorRevalidation: true,
    v7_relativeSplatPath: true,
  },
})

function App() {
  return (
    <Provider theme={defaultTheme} colorScheme="dark">
      <RouterProvider router={router} />
    </Provider>
  )
}

export default App
