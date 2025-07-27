import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from '@untitled-ui/icons-react';
import { View, Text, Flex } from '@adobe/react-spectrum';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  code?: string;
  codeLanguage?: string;
  isThinking?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  role, 
  content, 
  timestamp, 
  code, 
  codeLanguage,
  isThinking 
}) => {
  const isUser = role === 'user';
  
  return (
    <View marginBottom="size-300">
      <Flex justifyContent={isUser ? 'end' : 'start'}>
        <Flex 
          direction={isUser ? 'row-reverse' : 'row'} 
          gap="size-200" 
          maxWidth="80%"
        >
          {/* Avatar */}
          <View
            width="size-400"
            height="size-400"
            borderRadius="full"
            backgroundColor={isUser ? 'blue-600' : 'purple-600'}
            UNSAFE_style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isUser ? (
              <Icons.User01 size={18} color="white" />
            ) : (
              <Icons.CpuChip01 size={18} color="white" />
            )}
          </View>
          
          {/* Message Content */}
          <View
            padding="size-300"
            borderRadius="large"
            backgroundColor={isUser ? 'blue-600' : 'gray-800'}
            borderWidth={isUser ? 'none' : 'thin'}
            borderColor={isUser ? 'transparent' : 'gray-600'}
            UNSAFE_style={{
              color: isUser ? 'white' : '#f3f4f6'
            }}
          >
            {isThinking ? (
              <Flex alignItems="center" gap="size-100">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Icons.RefreshCcw01 size={16} />
                </motion.div>
                <Text UNSAFE_style={{ fontSize: '0.875rem' }}>Thinking...</Text>
              </Flex>
            ) : (
              <>
                <Text UNSAFE_style={{ 
                  fontSize: '0.875rem', 
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {content}
                </Text>
                
                {code && (
                  <View marginTop="size-200" position="relative">
                    <View
                      position="absolute"
                      top="size-100"
                      right="size-100"
                      zIndex={1}
                    >
                      <button
                        onClick={() => navigator.clipboard.writeText(code)}
                        style={{
                          padding: '4px',
                          background: 'rgba(55, 65, 81, 0.8)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                      >
                        <Icons.Copy01 size={14} color="white" />
                      </button>
                    </View>
                    <View
                      backgroundColor="gray-900"
                      padding="size-200"
                      borderRadius="medium"
                      UNSAFE_style={{ overflowX: 'auto' }}
                    >
                      <code style={{ 
                        fontSize: '0.75rem',
                        fontFamily: 'Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                        color: '#e5e7eb'
                      }}>
                        {code}
                      </code>
                    </View>
                  </View>
                )}
              </>
            )}
            
            {/* Timestamp */}
            <Text 
              marginTop="size-100"
              UNSAFE_style={{ 
                fontSize: '0.75rem',
                color: isUser ? '#bfdbfe' : '#9ca3af'
              }}
            >
              {timestamp ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
            </Text>
          </View>
        </Flex>
      </Flex>
    </View>
  );
};

export default MessageBubble;