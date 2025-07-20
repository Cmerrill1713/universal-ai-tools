/**
 * Athena Widget Creator
 * 
 * React component that allows users to create widgets through conversation with Athena
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { api } from '../../../services/api';
import { SweetAthenaChat } from '../Chat/SweetAthenaChat';
import { createAthenaTheme } from '../../../styles/athena-theme';

interface GeneratedWidget {
  id: string;
  name: string;
  description: string;
  componentCode: string;
  styleCode?: string;
  propsSchema: any;
  dependencies: string[];
  preview?: string;
  athenaExplanation: string;
}

interface AthenaWidgetCreatorProps {
  userId: string;
  conversationId: string;
  className?: string;
  onWidgetCreated?: (widget: GeneratedWidget) => void;
}

const WidgetCreatorContainer = styled(motion.div)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  height: 600px;
  background: linear-gradient(135deg, rgba(255, 182, 193, 0.1) 0%, rgba(255, 219, 172, 0.1) 100%);
  border-radius: 20px;
  padding: 20px;
  overflow: hidden;
`;

const ChatSection = styled.div`
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 182, 193, 0.3);
  overflow: hidden;
`;

const WidgetSection = styled.div`
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 182, 193, 0.3);
  overflow: hidden;
`;

const SectionHeader = styled.div`
  padding: 16px 20px;
  background: linear-gradient(135deg, #ffb6c1 0%, #ffdab8 100%);
  color: #8b4b6b;
  font-weight: 600;
  font-size: 1.1rem;
  border-bottom: 1px solid rgba(255, 182, 193, 0.3);
`;

const WidgetPreview = styled(motion.div)`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const CodeEditor = styled.div`
  background: #1e1e1e;
  border-radius: 12px;
  padding: 16px;
  color: #d4d4d4;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #333;
`;

const WidgetCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 182, 193, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
`;

const WidgetTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #8b4b6b;
  font-size: 1.2rem;
  font-weight: 600;
`;

const WidgetDescription = styled.p`
  margin: 0 0 16px 0;
  color: #666;
  font-size: 0.9rem;
  line-height: 1.4;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  ${props => props.variant === 'primary' ? `
    background: linear-gradient(135deg, #ffb6c1 0%, #ffdab8 100%);
    color: #8b4b6b;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 182, 193, 0.4);
    }
  ` : `
    background: rgba(255, 182, 193, 0.2);
    color: #8b4b6b;
    border: 1px solid rgba(255, 182, 193, 0.3);
    
    &:hover {
      background: rgba(255, 182, 193, 0.3);
    }
  `}
`;

const LoadingSpinner = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #8b4b6b;
`;

const LoadingDot = styled(motion.div)`
  width: 8px;
  height: 8px;
  background: #ffb6c1;
  border-radius: 50%;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  color: #8b4b6b;
  padding: 40px 20px;
`;

export const AthenaWidgetCreator: React.FC<AthenaWidgetCreatorProps> = ({
  userId,
  conversationId,
  className,
  onWidgetCreated
}) => {
  const [generatedWidget, setGeneratedWidget] = useState<GeneratedWidget | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [widgetHistory, setWidgetHistory] = useState<GeneratedWidget[]>([]);

  // Load widget history on mount
  useEffect(() => {
    loadWidgetHistory();
  }, [userId]);

  const loadWidgetHistory = async () => {
    try {
      const response = await api.request('/api/widgets/history', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userId}` // Simple auth for demo
        }
      });
      
      if (response.success) {
        setWidgetHistory(response.widgets || []);
      }
    } catch (error) {
      console.error('Failed to load widget history:', error);
    }
  };

  const handleWidgetRequest = useCallback(async (message: string) => {
    // Check if message is requesting widget creation
    if (!message.toLowerCase().includes('widget') && !message.toLowerCase().includes('component')) {
      return null; // Let normal chat handle it
    }

    setIsCreating(true);
    
    try {
      const response = await api.request('/api/widgets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          conversationId,
          message,
          context: {}
        })
      });

      if (response.success && response.widget) {
        setGeneratedWidget(response.widget);
        onWidgetCreated?.(response.widget);
        loadWidgetHistory(); // Refresh history
        
        return {
          content: response.content,
          personalityMood: response.personalityMood,
          sweetnessLevel: response.sweetnessLevel
        };
      }
      
      return null;
    } catch (error) {
      console.error('Widget creation failed:', error);
      return {
        content: "I'm sorry, I had trouble creating that widget. Could you try describing it differently? 🌸",
        personalityMood: 'apologetic',
        sweetnessLevel: 8
      };
    } finally {
      setIsCreating(false);
    }
  }, [userId, conversationId, onWidgetCreated]);

  const handleUpdateWidget = async (feedback: string) => {
    if (!generatedWidget) return;

    setIsCreating(true);
    
    try {
      const response = await api.request('/api/widgets/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          widgetId: generatedWidget.id,
          feedback,
          updates: {}
        })
      });

      if (response.success) {
        setGeneratedWidget(response.widget);
      }
    } catch (error) {
      console.error('Widget update failed:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const exportWidget = async () => {
    if (!generatedWidget) return;

    try {
      const response = await api.request(`/api/widgets/${generatedWidget.id}/export?format=typescript`);
      
      if (response.success) {
        // Create download
        const blob = new Blob([response.export], { type: 'text/typescript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generatedWidget.name}.tsx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const loadingVariants = {
    animate: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const dotVariants = {
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const theme = createAthenaTheme('sweet');

  return (
    <WidgetCreatorContainer
      className={className}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <ChatSection>
        <SectionHeader>Chat with Athena 💬</SectionHeader>
        <SweetAthenaChat
          userId={userId}
          conversationId={conversationId}
          onCustomMessageHandler={handleWidgetRequest}
          placeholder="Ask me to create a widget for you! 🎨"
          showAvatar={false}
        />
      </ChatSection>

      <WidgetSection>
        <SectionHeader>Widget Creator ✨</SectionHeader>
        <WidgetPreview>
          <AnimatePresence mode="wait">
            {isCreating && (
              <LoadingSpinner
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                variants={loadingVariants}
              >
                <span>Creating your widget</span>
                {[0, 1, 2].map(i => (
                  <LoadingDot
                    key={i}
                    variants={dotVariants}
                    animate="animate"
                  />
                ))}
              </LoadingSpinner>
            )}

            {!isCreating && generatedWidget && (
              <WidgetCard
                key={generatedWidget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <WidgetTitle>{generatedWidget.name}</WidgetTitle>
                <WidgetDescription>{generatedWidget.description}</WidgetDescription>
                
                <div style={{ marginBottom: '16px', color: '#8b4b6b', fontSize: '0.9rem' }}>
                  <strong>Dependencies:</strong> {generatedWidget.dependencies.join(', ')}
                </div>

                {showCode && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <CodeEditor>
                      <pre>{generatedWidget.componentCode}</pre>
                    </CodeEditor>
                  </motion.div>
                )}

                <ButtonGroup>
                  <ActionButton
                    variant="primary"
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? 'Hide Code' : 'View Code'}
                  </ActionButton>
                  <ActionButton onClick={exportWidget}>
                    Export
                  </ActionButton>
                  <ActionButton onClick={() => handleUpdateWidget('Make it more colorful')}>
                    Enhance
                  </ActionButton>
                </ButtonGroup>
              </WidgetCard>
            )}

            {!isCreating && !generatedWidget && (
              <EmptyState key="empty">
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎨</div>
                <h3 style={{ margin: '0 0 8px 0' }}>Ready to Create!</h3>
                <p style={{ margin: 0, opacity: 0.7 }}>
                  Ask me to create a widget and I'll build it for you!
                </p>
                <div style={{ marginTop: '20px', fontSize: '0.9rem', opacity: 0.6 }}>
                  Try saying: "Create a weather widget" or "Make a todo list component"
                </div>
              </EmptyState>
            )}
          </AnimatePresence>

          {widgetHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h4 style={{ color: '#8b4b6b', marginBottom: '12px' }}>Recent Widgets</h4>
              {widgetHistory.slice(0, 3).map((widget, index) => (
                <motion.div
                  key={widget.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(255, 182, 193, 0.1)',
                    borderRadius: '8px',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onClick={() => setGeneratedWidget(widget)}
                  whileHover={{ background: 'rgba(255, 182, 193, 0.2)' }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', color: '#8b4b6b' }}>
                    {widget.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                    {widget.description.slice(0, 50)}...
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </WidgetPreview>
      </WidgetSection>
    </WidgetCreatorContainer>
  );
};

export default AthenaWidgetCreator;