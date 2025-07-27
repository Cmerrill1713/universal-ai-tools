# TaskExecutionVisualizer Component

A comprehensive React component for visualizing real-time task execution progress with agent collaboration features.

## Features

### Visual Features
- **Checklist UI**: Hierarchical task display with expandable/collapsible subtasks
- **Strikethrough**: Completed tasks are visually marked with strikethrough text
- **Progress Bars**: Real-time progress visualization for active tasks
- **Color Coding**: Status-based color indicators (gray for pending, blue for in-progress, green for completed, red for failed)
- **Dark Mode Support**: Fully responsive dark mode styling

### Interactive Features
- **Real-time Updates**: Live progress tracking and status changes
- **Agent Activity Indicators**: Shows which agents are working on which tasks
- **Execution Timeline**: Timestamps showing start time and duration
- **Task Selection**: Click handling for task interaction
- **Auto-scroll**: Automatically scrolls to show latest activity
- **Overall Progress**: Top-level progress bar showing completion percentage

## Usage

```tsx
import TaskExecutionVisualizer from './components/TaskExecutionVisualizer'

const tasks = [
  {
    id: '1',
    name: 'Initialize Project',
    description: 'Setting up project structure',
    status: 'completed',
    progress: 100,
    startTime: new Date(),
    endTime: new Date(),
    agentId: 'setup-agent',
    subtasks: [
      {
        id: '1.1',
        name: 'Install dependencies',
        status: 'completed',
        progress: 100
      }
    ]
  },
  {
    id: '2',
    name: 'Build Components',
    status: 'in-progress',
    progress: 65,
    startTime: new Date(),
    agentId: 'ui-agent'
  }
]

const agents = [
  {
    id: 'setup-agent',
    name: 'Setup Agent',
    status: 'idle'
  },
  {
    id: 'ui-agent',
    name: 'UI Agent',
    status: 'busy',
    currentTaskId: '2'
  }
]

function MyComponent() {
  const handleTaskClick = (task) => {
    console.log('Task clicked:', task)
  }

  return (
    <TaskExecutionVisualizer
      tasks={tasks}
      agents={agents}
      onTaskClick={handleTaskClick}
      className="my-custom-class"
    />
  )
}
```

## Props

### TaskExecutionVisualizerProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tasks` | `Task[]` | Yes | Array of tasks to display |
| `agents` | `Agent[]` | No | Array of agents working on tasks |
| `onTaskClick` | `(task: Task) => void` | No | Callback when a task is clicked |
| `className` | `string` | No | Additional CSS classes |

### Task Interface

```typescript
interface Task {
  id: string
  name: string
  description?: string
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
  progress?: number // 0-100
  startTime?: Date
  endTime?: Date
  error?: string
  subtasks?: Task[]
  agentId?: string
  agentName?: string
}
```

### Agent Interface

```typescript
interface Agent {
  id: string
  name: string
  status: 'idle' | 'busy' | 'error'
  currentTaskId?: string
  avatar?: string // Single character or emoji
}
```

## Styling

The component uses Tailwind CSS for styling and includes:
- Responsive design
- Dark mode support
- Smooth animations and transitions
- Hover effects
- Status-based color schemes

## Demo

To see the component in action, navigate to `/task-execution` in your development environment or run:

```bash
npm start
# Navigate to http://localhost:3000/task-execution
```

The demo includes:
- Interactive simulation controls
- Real-time task progression
- Agent activity visualization
- Complete feature demonstration

## Testing

Run the test suite:

```bash
npm test TaskExecutionVisualizer.test.tsx
```

Tests cover:
- Task rendering
- Status visualization
- Progress tracking
- User interactions
- Agent display
- Error handling