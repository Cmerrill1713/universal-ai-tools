;
import { Activity, Server, Cpu, HardDrive } from 'lucide-react';
import { Card } from '../components/Card';

export function Monitoring() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">System Monitoring</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Cpu className="h-5 w-5 text-blue-500" />
            <span className="font-medium">CPU Usage</span>
          </div>
          <div className="text-2xl font-bold">42%</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '42%' }} />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-2">
            <HardDrive className="h-5 w-5 text-green-500" />
            <span className="font-medium">Memory</span>
          </div>
          <div className="text-2xl font-bold">8.2GB</div>
          <div className="text-sm text-gray-400">of 16GB used</div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Server className="h-5 w-5 text-purple-500" />
            <span className="font-medium">Services</span>
          </div>
          <div className="text-2xl font-bold">6/7</div>
          <div className="text-sm text-gray-400">running</div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center space-x-3 mb-2">
            <Activity className="h-5 w-5 text-yellow-500" />
            <span className="font-medium">Requests</span>
          </div>
          <div className="text-2xl font-bold">1.2K</div>
          <div className="text-sm text-gray-400">last hour</div>
        </Card>
      </div>
      
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">External Monitoring</h3>
        <div className="space-y-2">
          <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer" 
             className="block p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
            📊 Prometheus - Metrics Collection
          </a>
          <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
             className="block p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
            📈 Grafana - Data Visualization
          </a>
        </div>
      </Card>
    </div>
  );
}