import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from '@untitled-ui/icons-react';
import { 
  ActionButton, 
  TooltipTrigger, 
  Tooltip 
} from '@adobe/react-spectrum';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload?: (file: File) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onFileUpload,
  isLoading,
  placeholder = "Type your message..."
}) => {
  const [showAttachments, setShowAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  return (
    <div className="relative">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-lg">
        <div className="flex items-end gap-3">
          {/* Attachment Button */}
          <motion.div className="flex items-center gap-2">
            <TooltipTrigger>
              <ActionButton
                isQuiet
                onPress={() => fileInputRef.current?.click()}
                isDisabled={isLoading}
              >
                <Icons.Paperclip size={20} />
              </ActionButton>
              <Tooltip>Attach file</Tooltip>
            </TooltipTrigger>
            
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".txt,.md,.js,.ts,.jsx,.tsx,.json,.py,.java,.cpp,.c,.h,.cs,.rb,.go,.rs,.swift,.kt,.php,.html,.css,.scss,.yaml,.yml,.xml,.sql"
            />
          </motion.div>

          {/* Text Input */}
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            className="
              flex-1 bg-transparent border-none outline-none resize-none
              text-gray-100 placeholder-gray-500 text-sm
              max-h-32 min-h-[20px]
            "
            rows={1}
            style={{
              height: 'auto',
              overflowY: 'auto'
            }}
          />

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Voice Input (placeholder) */}
            <TooltipTrigger>
              <ActionButton
                isQuiet
                onPress={() => console.log('Voice input')}
                isDisabled={isLoading}
              >
                <Icons.Microphone01 size={20} />
              </ActionButton>
              <Tooltip>Voice input</Tooltip>
            </TooltipTrigger>

            {/* Send Button */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={onSend}
                disabled={isLoading || !value.trim()}
                className={`
                  p-2 rounded-lg transition-all
                  ${isLoading || !value.trim()
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Icons.RefreshCw01 size={20} />
                  </motion.div>
                ) : (
                  <Icons.Send01 size={20} />
                )}
              </button>
            </motion.div>
          </div>
        </div>

        {/* Character count */}
        {value.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 text-right">
            {value.length} characters
          </div>
        )}
      </div>

      {/* Quick Commands */}
      <AnimatePresence>
        {value.startsWith('/') && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-full mb-2 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg p-2 shadow-lg"
          >
            <div className="text-xs text-gray-400 mb-2">Quick Commands</div>
            <div className="space-y-1">
              <button className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-300">
                <span className="text-blue-400">/clear</span> - Clear conversation
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-300">
                <span className="text-blue-400">/code</span> - Generate code
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-300">
                <span className="text-blue-400">/agents</span> - Show available agents
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-700 rounded text-sm text-gray-300">
                <span className="text-blue-400">/help</span> - Show help
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};