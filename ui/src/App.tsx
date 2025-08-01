import React from 'react'
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom'
import { Provider, defaultTheme } from '@adobe/react-spectrum'
import Navigation from './components/Navigation/Navigation'
import DashboardModern from './pages/DashboardModern'
import ChatEnhanced from './pages/ChatEnhanced'
import ChatModern from './pages/ChatModern'
import VisionStudio from './pages/VisionStudio'
import MLXTraining from './pages/MLXTraining'
import OrchestrationDashboard from './pages/OrchestrationDashboard'
import MonitoringDashboard from './pages/MonitoringDashboard'
import ModelsManager from './pages/ModelsManager'
import Agents from './pages/Agents'
import Memory from './pages/Memory'
import AgentPerformanceDemo from './pages/AgentPerformanceDemo'
import AgentActivityMonitorDemo from './pages/AgentActivityMonitorDemo'
import TaskExecutionDemo from './pages/TaskExecutionDemo'
import ApiKeysManager from './pages/ApiKeysManager'
import Athena from './pages/Athena'

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
    children: [
      { index: true, element: <DashboardModern /> },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { path: 'athena', element: <Athena /> },
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