;
import { Save } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';

export function Settings() {
  const models = [
    { value: 'llama3.2:1b', label: 'Llama 3.2 1B (Fast)' },
    { value: 'llama3.2:3b', label: 'Llama 3.2 3B (Balanced)' },
    { value: 'phi3:mini', label: 'Phi-3 Mini (Code)' },
    { value: 'mistral:7b', label: 'Mistral 7B (Quality)' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Settings</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Default Model</label>
              <Select
                value="llama3.2:3b"
                onChange={() => {}}
                options={models}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Temperature</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                defaultValue="0.7"
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Max Tokens</label>
              <input
                type="number"
                defaultValue="2048"
                className="w-full bg-gray-700 rounded px-3 py-2"
              />
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">System Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Endpoint</label>
              <input
                type="text"
                defaultValue="http://localhost:3000"
                className="w-full bg-gray-700 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">WebSocket URL</label>
              <input
                type="text"
                defaultValue="ws://localhost:9999"
                className="w-full bg-gray-700 rounded px-3 py-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" defaultChecked />
              <label className="text-sm">Enable real-time updates</label>
            </div>
          </div>
        </Card>
      </div>
      
      <div className="flex justify-end">
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}