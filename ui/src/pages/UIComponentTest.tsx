import React, { useState } from 'react';
import { 
  Provider, 
  defaultTheme,
  Button,
  ActionButton,
  TextField,
  Switch,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  ProgressBar,
  StatusLight,
  Well,
  View,
  Flex,
  Text,
  Heading
} from '@adobe/react-spectrum';
import * as Icons from '@untitled-ui/icons-react';
import { motion } from 'framer-motion';
import { MessageBubble } from '../components/Chat/MessageBubble';
import { ChatInput } from '../components/Chat/ChatInput';

export default function UIComponentTest() {
  const [inputValue, setInputValue] = useState('');
  const [switchValue, setSwitchValue] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [checkboxValues, setCheckboxValues] = useState(['option1']);
  const [chatInput, setChatInput] = useState('');

  return (
    <Provider theme={defaultTheme} colorScheme="dark">
      <div className="p-8 bg-gray-900 min-h-screen text-gray-100">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          UI Component Test Page
        </h1>

        {/* React Spectrum Components */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">React Spectrum Components</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Buttons */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Buttons</h3>
              <Flex direction="column" gap="size-200">
                <Button variant="accent">Accent Button</Button>
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <ActionButton>
                  <Icons.Plus size={18} />
                  <Text>Action Button</Text>
                </ActionButton>
              </Flex>
            </div>

            {/* Form Controls */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Form Controls</h3>
              <Flex direction="column" gap="size-200">
                <TextField 
                  label="Text Input" 
                  value={inputValue}
                  onChange={setInputValue}
                />
                <Switch isSelected={switchValue} onChange={setSwitchValue}>
                  Toggle Switch
                </Switch>
              </Flex>
            </div>

            {/* Selection */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Selection</h3>
              <Flex direction="column" gap="size-200">
                <RadioGroup label="Radio Group" value={radioValue} onChange={setRadioValue}>
                  <Radio value="option1">Option 1</Radio>
                  <Radio value="option2">Option 2</Radio>
                </RadioGroup>
                <CheckboxGroup 
                  label="Checkbox Group" 
                  value={checkboxValues}
                  onChange={setCheckboxValues}
                >
                  <Checkbox value="option1">Option 1</Checkbox>
                  <Checkbox value="option2">Option 2</Checkbox>
                </CheckboxGroup>
              </Flex>
            </div>

            {/* Status Indicators */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-lg font-medium mb-4">Status Indicators</h3>
              <Flex direction="column" gap="size-200">
                <StatusLight variant="positive">Online</StatusLight>
                <StatusLight variant="negative">Offline</StatusLight>
                <StatusLight variant="notice">Warning</StatusLight>
                <StatusLight variant="info">Info</StatusLight>
                <ProgressBar label="Progress" value={75} />
              </Flex>
            </div>
          </div>
        </section>

        {/* Untitled UI Icons */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Untitled UI Icons</h2>
          <div className="bg-gray-800 p-6 rounded-lg">
            <div className="grid grid-cols-6 md:grid-cols-10 gap-4">
              {[
                Icons.Home01,
                Icons.User01,
                Icons.Settings01,
                Icons.SearchMd,
                Icons.Mail01,
                Icons.Calendar,
                Icons.Bell01,
                Icons.Heart,
                Icons.Star01,
                Icons.Download01,
                Icons.Upload01,
                Icons.Trash01,
                Icons.Edit02,
                Icons.Copy01,
                Icons.Check,
                Icons.X,
                Icons.Plus,
                Icons.Minus,
                Icons.ArrowRight,
                Icons.RefreshCw01
              ].map((Icon, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.2 }}
                  className="p-3 bg-gray-700 rounded-lg flex items-center justify-center cursor-pointer"
                >
                  <Icon size={24} />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Chat Components */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Chat Components</h2>
          
          <div className="bg-gray-800 p-6 rounded-lg space-y-6">
            {/* Message Bubbles */}
            <div>
              <h3 className="text-lg font-medium mb-4">Message Bubbles</h3>
              <div className="space-y-4">
                <MessageBubble
                  role="user"
                  content="Hello! Can you help me with React?"
                  timestamp={new Date()}
                />
                <MessageBubble
                  role="assistant"
                  content="Of course! I'd be happy to help you with React. What would you like to know?"
                  timestamp={new Date()}
                />
                <MessageBubble
                  role="assistant"
                  content="Here's a simple React component example:"
                  code={`function Hello() {
  return <h1>Hello, World!</h1>;
}`}
                  codeLanguage="javascript"
                  timestamp={new Date()}
                />
              </div>
            </div>

            {/* Chat Input */}
            <div>
              <h3 className="text-lg font-medium mb-4">Chat Input</h3>
              <ChatInput
                value={chatInput}
                onChange={setChatInput}
                onSend={() => {
                  console.log('Message sent:', chatInput);
                  setChatInput('');
                }}
                onFileUpload={(file) => console.log('File uploaded:', file)}
              />
            </div>
          </div>
        </section>

        {/* Framer Motion Animations */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Animations (Framer Motion)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              className="bg-gray-800 p-6 rounded-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <h3 className="text-lg font-medium mb-2">Hover & Tap</h3>
              <p className="text-gray-400">Hover or click me!</p>
            </motion.div>

            <motion.div
              className="bg-gray-800 p-6 rounded-lg"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <h3 className="text-lg font-medium mb-2">Rotating</h3>
              <p className="text-gray-400">I'm spinning!</p>
            </motion.div>

            <motion.div
              className="bg-gray-800 p-6 rounded-lg"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <h3 className="text-lg font-medium mb-2">Bouncing</h3>
              <p className="text-gray-400">Up and down!</p>
            </motion.div>
          </div>
        </section>

        {/* Color Palette */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Color Palette</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              'bg-blue-600',
              'bg-purple-600',
              'bg-green-600',
              'bg-yellow-600',
              'bg-red-600',
              'bg-gray-600',
              'bg-indigo-600',
              'bg-pink-600'
            ].map((color) => (
              <div key={color} className="text-center">
                <div className={`${color} h-20 rounded-lg mb-2`} />
                <p className="text-sm text-gray-400">{color}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Provider>
  );
}