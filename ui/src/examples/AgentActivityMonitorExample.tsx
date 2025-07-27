import React, { useState, useEffect } from 'react'
import AgentActivityMonitor from '../components/AgentActivityMonitor'
import type { AgentActivity } from '../components/AgentActivityMonitor'

/**
 * Example showing how to integrate AgentActivityMonitor with real agent data
 */
export default function AgentActivityMonitorExample() {
  const [activities, setActivities] = useState<AgentActivity[]>([])

  // Simulate receiving activities from WebSocket or API
  useEffect(() => {
    // Initial screen recording activity
    const screenActivity: AgentActivity = {
      id: '1',
      agentId: 'ui-agent-001',
      agentName: 'UI Automation Agent',
      type: 'screen-recording',
      timestamp: new Date(),
      status: 'active',
      data: {
        screenshot: 'base64-encoded-screenshot-data',
        mousePosition: { x: 500, y: 300 },
        action: 'Analyzing user interface'
      }
    }
    
    setActivities([screenActivity])

    // Simulate button click after 2 seconds
    setTimeout(() => {
      const buttonActivity: AgentActivity = {
        id: '2',
        agentId: 'ui-agent-001',
        agentName: 'UI Automation Agent',
        type: 'button-press',
        timestamp: new Date(),
        status: 'completed',
        data: {
          elementId: 'submit-form-btn',
          elementText: 'Submit',
          elementClass: 'btn-primary',
          coordinates: { x: 750, y: 450 }
        }
      }
      
      setActivities(prev => [...prev, buttonActivity])
    }, 2000)

    // Simulate form filling after 4 seconds
    setTimeout(() => {
      const formActivity: AgentActivity = {
        id: '3',
        agentId: 'form-agent-002',
        agentName: 'Form Processor',
        type: 'form-fill',
        timestamp: new Date(),
        status: 'active',
        data: {
          formId: 'contact-form',
          fields: [
            { name: 'name', value: 'John Doe', type: 'text' },
            { name: 'email', value: 'john@example.com', type: 'email' },
            { name: 'message', value: 'Hello, this is a test message', type: 'textarea' }
          ],
          progress: 33
        }
      }
      
      setActivities(prev => [...prev, formActivity])
      
      // Update progress
      let progress = 33
      const progressInterval = setInterval(() => {
        progress += 33
        if (progress >= 100) {
          clearInterval(progressInterval)
          setActivities(prev => prev.map(a => 
            a.id === '3' 
              ? { ...a, status: 'completed' as const, data: { ...a.data, progress: 100 } }
              : a
          ))
        } else {
          setActivities(prev => prev.map(a => 
            a.id === '3' 
              ? { ...a, data: { ...a.data, progress } }
              : a
          ))
        }
      }, 1000)
    }, 4000)

    // Simulate code execution after 6 seconds
    setTimeout(() => {
      const codeActivity: AgentActivity = {
        id: '4',
        agentId: 'code-agent-003',
        agentName: 'Code Executor',
        type: 'code-execution',
        timestamp: new Date(),
        status: 'completed',
        data: {
          language: 'javascript',
          code: `function validateForm(data) {
  return data.name && data.email && data.message
}

const isValid = validateForm({
  name: 'John Doe',
  email: 'john@example.com',
  message: 'Hello, this is a test message'
})

console.log('Form is valid:', isValid)`,
          output: 'Form is valid: true',
          executionTime: 45
        }
      }
      
      setActivities(prev => [...prev, codeActivity])
    }, 6000)

    // Simulate test results after 8 seconds
    setTimeout(() => {
      const testActivity: AgentActivity = {
        id: '5',
        agentId: 'test-agent-004',
        agentName: 'Test Runner',
        type: 'test-result',
        timestamp: new Date(),
        status: 'completed',
        data: {
          name: 'Form Submission Test',
          suite: 'E2E Tests',
          status: 'pass',
          duration: 523,
          assertions: [
            { description: 'Form is rendered', passed: true },
            { description: 'All fields are fillable', passed: true },
            { description: 'Validation works correctly', passed: true },
            { description: 'Form submits successfully', passed: true }
          ]
        }
      }
      
      setActivities(prev => [...prev, testActivity])
    }, 8000)
  }, [])

  const handleActivityClick = (activity: AgentActivity) => {
    console.log('Activity clicked:', activity)
    // Here you could show more details, open a modal, etc.
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Agent Activity Monitor Example</h1>
      
      <AgentActivityMonitor
        activities={activities}
        onActivityClick={handleActivityClick}
        showMinimap={true}
        autoScroll={true}
        className="shadow-lg"
      />
      
      <div className="mt-8 bg-gray-100 dark:bg-gray-800 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Integration Guide</h2>
        <pre className="text-sm overflow-x-auto">
{`// 1. Import the component
import AgentActivityMonitor from '@/components/AgentActivityMonitor'

// 2. Define your activities
const activities = [
  {
    id: '1',
    agentId: 'agent-001',
    agentName: 'My Agent',
    type: 'screen-recording',
    timestamp: new Date(),
    status: 'active',
    data: {
      screenshot: 'base64...',
      mousePosition: { x: 100, y: 200 }
    }
  }
]

// 3. Use the component
<AgentActivityMonitor
  activities={activities}
  onActivityClick={handleClick}
  showMinimap={true}
  autoScroll={true}
/>`}
        </pre>
      </div>
    </div>
  )
}