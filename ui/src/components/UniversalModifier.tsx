import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface ModificationRequest {
  type: 'ui' | 'style' | 'behavior' | 'data' | 'component'
  target: string
  change: string
  preview?: boolean
}

export default function UniversalModifier() {
  const [modifications, setModifications] = useState<ModificationRequest[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // Listen for modification commands
  useEffect(() => {
    const handleModificationCommand = async (command: string) => {
      setIsProcessing(true)
      
      try {
        // Parse the modification request
        if (command.toLowerCase().includes('change') || 
            command.toLowerCase().includes('modify') || 
            command.toLowerCase().includes('update') ||
            command.toLowerCase().includes('make')) {
          
          // Extract what to change
          const modification: ModificationRequest = {
            type: 'ui',
            target: '',
            change: command,
            preview: true
          }

          // Detect modification type
          if (command.includes('color') || command.includes('style') || command.includes('theme')) {
            modification.type = 'style'
          } else if (command.includes('behavior') || command.includes('function') || command.includes('action')) {
            modification.type = 'behavior'
          } else if (command.includes('data') || command.includes('content') || command.includes('text')) {
            modification.type = 'data'
          } else if (command.includes('component') || command.includes('element') || command.includes('widget')) {
            modification.type = 'component'
          }

          // Apply the modification
          await applyModification(modification)
          setModifications(prev => [...prev, modification])
        }
      } catch (error) {
        console.error('Modification error:', error)
      } finally {
        setIsProcessing(false)
      }
    }

    // Expose global function for chat to call
    (window as any).handleModificationCommand = handleModificationCommand

    return () => {
      delete (window as any).handleModificationCommand
    }
  }, [])

  const applyModification = async (mod: ModificationRequest) => {
    switch (mod.type) {
      case 'style':
        applyStyleChange(mod)
        break
      case 'behavior':
        applyBehaviorChange(mod)
        break
      case 'data':
        applyDataChange(mod)
        break
      case 'component':
        applyComponentChange(mod)
        break
      default:
        applyUIChange(mod)
    }
  }

  const applyStyleChange = (mod: ModificationRequest) => {
    // Create dynamic styles
    const styleId = `dynamic-style-${Date.now()}`
    const style = document.createElement('style')
    style.id = styleId
    
    // Parse the change request
    if (mod.change.includes('dark')) {
      style.textContent = `
        body { background-color: #000 !important; color: #fff !important; }
        .bg-gray-900 { background-color: #111 !important; }
        .bg-gray-800 { background-color: #222 !important; }
      `
    } else if (mod.change.includes('light')) {
      style.textContent = `
        body { background-color: #fff !important; color: #000 !important; }
        .bg-gray-900 { background-color: #f5f5f5 !important; }
        .bg-gray-800 { background-color: #e5e5e5 !important; }
        .text-white { color: #000 !important; }
        .text-gray-300 { color: #333 !important; }
      `
    } else if (mod.change.includes('blue')) {
      style.textContent = `
        .bg-blue-600 { background-color: #1e40af !important; }
        .bg-gray-900 { background-color: #1e3a8a !important; }
      `
    } else if (mod.change.includes('larger') || mod.change.includes('bigger')) {
      style.textContent = `
        body { font-size: 120% !important; }
        .text-sm { font-size: 1rem !important; }
        .text-xs { font-size: 0.875rem !important; }
      `
    }
    
    document.head.appendChild(style)
  }

  const applyBehaviorChange = (mod: ModificationRequest) => {
    // Modify behaviors dynamically
    if (mod.change.includes('auto') && mod.change.includes('save')) {
      // Enable auto-save
      setInterval(() => {
        console.log('Auto-saving...')
        // Implement auto-save logic
      }, 30000)
    } else if (mod.change.includes('sound') || mod.change.includes('audio')) {
      // Add sound effects
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmFgU7k9n1unEiBC13yO/eizEIHWq+8+OWT' +
                      'AkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1unEiBC13yO/eizEIHWq+8+OWTAkPU6zq67VlGAU7k9n1u')
      
      // Play sound on message
      const originalHandleSubmit = (window as any).handleChatSubmit
      if (originalHandleSubmit) {
        (window as any).handleChatSubmit = (...args: any[]) => {
          audio.play()
          return originalHandleSubmit(...args)
        }
      }
    }
  }

  const applyDataChange = (mod: ModificationRequest) => {
    // Modify data/content
    if (mod.change.includes('title')) {
      const newTitle = mod.change.match(/"([^"]+)"/)?.[1] || 'Universal AI'
      document.title = newTitle
      const titleElements = document.querySelectorAll('h1')
      titleElements.forEach(el => {
        if (el.textContent?.includes('Universal AI')) {
          el.textContent = newTitle
        }
      })
    }
  }

  const applyComponentChange = (mod: ModificationRequest) => {
    // Add new components dynamically
    if (mod.change.includes('clock') || mod.change.includes('time')) {
      // Add a clock widget
      const clockContainer = document.createElement('div')
      clockContainer.className = 'fixed top-4 left-4 bg-gray-800 text-white p-3 rounded-lg shadow-lg z-50'
      clockContainer.innerHTML = '<div id="live-clock" class="text-lg font-mono"></div>'
      document.body.appendChild(clockContainer)
      
      // Update clock
      setInterval(() => {
        const clock = document.getElementById('live-clock')
        if (clock) {
          clock.textContent = new Date().toLocaleTimeString()
        }
      }, 1000)
    } else if (mod.change.includes('progress') || mod.change.includes('status')) {
      // Add a progress indicator
      const progressContainer = document.createElement('div')
      progressContainer.className = 'fixed bottom-4 left-4 bg-gray-800 text-white p-3 rounded-lg shadow-lg z-50'
      progressContainer.innerHTML = `
        <div class="text-sm mb-2">System Status</div>
        <div class="w-48 bg-gray-700 rounded-full h-2">
          <div class="bg-green-500 h-2 rounded-full animate-pulse" style="width: 75%"></div>
        </div>
      `
      document.body.appendChild(progressContainer)
    }
  }

  const applyUIChange = (mod: ModificationRequest) => {
    // General UI changes
    console.log('Applying UI change:', mod)
  }

  if (isProcessing) {
    return (
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-xl z-50">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white">Applying modifications...</span>
        </div>
      </div>
    )
  }

  return null
}