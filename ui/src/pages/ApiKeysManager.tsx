import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Save, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Shield,
  Clock,
  Server,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';

interface ApiSecret {
  service_name: string;
  description?: string;
  is_active: boolean;
  expires_at?: string;
  has_key: boolean;
  rate_limit?: any;
  metadata?: any;
}

interface ServiceConfig {
  service_name: string;
  base_url: string;
  auth_type: string;
  required_env_vars?: string[];
  optional_env_vars?: string[];
  metadata?: any;
}

const ApiKeysManager: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [secrets, setSecrets] = useState<Map<string, ApiSecret>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showKey, setShowKey] = useState<Map<string, boolean>>(new Map());
  const [editingKey, setEditingKey] = useState<Map<string, string>>(new Map());
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // Get all service configurations
      const servicesRes = await fetch('/api/v1/secrets/services');
      const servicesData = await servicesRes.json();
      
      if (servicesData.success) {
        setServices(servicesData.data.services || []);
        
        // Create secrets map
        const secretsMap = new Map<string, ApiSecret>();
        servicesData.data.secrets?.forEach((secret: any) => {
          secretsMap.set(secret.service_name, secret);
        });
        setSecrets(secretsMap);
      }
    } catch (error) {
      showNotification('error', 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async (serviceName: string, apiKey: string) => {
    if (!apiKey.trim()) {
      showNotification('error', 'API key cannot be empty');
      return;
    }

    setSaving(serviceName);
    try {
      const response = await fetch('/api/v1/secrets/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_name: serviceName,
          api_key: apiKey,
          description: `API key for ${serviceName}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification('success', `API key for ${serviceName} saved successfully`);
        setEditingKey(new Map(editingKey).set(serviceName, ''));
        setShowKey(new Map(showKey).set(serviceName, false));
        await loadServices();
      } else {
        showNotification('error', data.error || 'Failed to save API key');
      }
    } catch (error) {
      showNotification('error', 'Failed to save API key');
    } finally {
      setSaving(null);
    }
  };

  const deleteApiKey = async (serviceName: string) => {
    if (!confirm(`Are you sure you want to delete the API key for ${serviceName}?`)) {
      return;
    }

    setSaving(serviceName);
    try {
      const response = await fetch(`/api/v1/secrets/delete/${serviceName}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification('success', `API key for ${serviceName} deleted`);
        await loadServices();
      } else {
        showNotification('error', data.error || 'Failed to delete API key');
      }
    } catch (error) {
      showNotification('error', 'Failed to delete API key');
    } finally {
      setSaving(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showNotification('success', 'Copied to clipboard');
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const getStatusColor = (hasKey: boolean, isActive: boolean) => {
    if (!hasKey) return 'text-gray-500';
    if (!isActive) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusIcon = (hasKey: boolean, isActive: boolean) => {
    if (!hasKey) return <AlertCircle className="w-5 h-5" />;
    if (!isActive) return <Clock className="w-5 h-5" />;
    return <CheckCircle className="w-5 h-5" />;
  };

  const getStatusText = (hasKey: boolean, isActive: boolean) => {
    if (!hasKey) return 'No API Key';
    if (!isActive) return 'Inactive';
    return 'Active';
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'} backdrop-blur-sm border-b sticky top-0 z-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-6 h-6 text-blue-500" />
                <h1 className="text-xl font-semibold">API Keys Manager</h1>
              </div>
              <span className="text-sm text-gray-500">Secure secrets management with Supabase Vault</span>
            </div>
            <button
              onClick={() => loadServices()}
              disabled={loading}
              className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
              notification.type === 'success' 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span>{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid gap-4">
            {services.map((service) => {
              const secret = secrets.get(service.service_name);
              const hasKey = secret?.has_key || false;
              const isActive = secret?.is_active ?? true;
              const isEditing = editingKey.has(service.service_name);
              const isShowing = showKey.get(service.service_name) || false;

              return (
                <motion.div
                  key={service.service_name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  } rounded-xl border p-6`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Server className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-semibold capitalize">
                          {service.service_name.replace(/_/g, ' ')}
                        </h3>
                        <div className={`flex items-center space-x-1 ${getStatusColor(hasKey, isActive)}`}>
                          {getStatusIcon(hasKey, isActive)}
                          <span className="text-sm">{getStatusText(hasKey, isActive)}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-500">
                        <p>Base URL: <code className="text-xs bg-gray-700 px-2 py-1 rounded">{service.base_url}</code></p>
                        <p>Auth Type: <span className="font-medium">{service.auth_type}</span></p>
                        {service.required_env_vars && service.required_env_vars.length > 0 && (
                          <p>Required: <code className="text-xs bg-gray-700 px-2 py-1 rounded">{service.required_env_vars.join(', ')}</code></p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {hasKey && (
                        <>
                          <button
                            onClick={() => setShowKey(new Map(showKey).set(service.service_name, !isShowing))}
                            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                            title={isShowing ? 'Hide API Key' : 'Show API Key'}
                          >
                            {isShowing ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => deleteApiKey(service.service_name)}
                            disabled={saving === service.service_name}
                            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors text-red-500`}
                            title="Delete API Key"
                          >
                            {saving === service.service_name ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* API Key Input */}
                  {(isEditing || !hasKey) && (
                    <div className="mt-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type={isShowing ? 'text' : 'password'}
                          value={editingKey.get(service.service_name) || ''}
                          onChange={(e) => setEditingKey(new Map(editingKey).set(service.service_name, e.target.value))}
                          placeholder={hasKey ? 'Enter new API key' : 'Enter API key'}
                          className={`flex-1 px-4 py-2 rounded-lg outline-none ${
                            darkMode 
                              ? 'bg-gray-700 text-gray-100 placeholder-gray-400' 
                              : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                          }`}
                        />
                        <button
                          onClick={() => saveApiKey(service.service_name, editingKey.get(service.service_name) || '')}
                          disabled={!editingKey.get(service.service_name)?.trim() || saving === service.service_name}
                          className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                            editingKey.get(service.service_name)?.trim() && saving !== service.service_name
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : darkMode 
                                ? 'bg-gray-700 text-gray-500'
                                : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {saving === service.service_name ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-5 h-5" />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                        {hasKey && (
                          <button
                            onClick={() => setEditingKey(new Map(editingKey).delete(service.service_name))}
                            className={`p-2 rounded-lg ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Edit Button for existing keys */}
                  {hasKey && !isEditing && (
                    <div className="mt-4">
                      <button
                        onClick={() => setEditingKey(new Map(editingKey).set(service.service_name, ''))}
                        className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
                      >
                        Update API Key
                      </button>
                    </div>
                  )}

                  {/* Additional Info */}
                  {secret && (
                    <div className="mt-4 pt-4 border-t border-gray-700 space-y-2 text-sm text-gray-500">
                      {secret.rate_limit && (
                        <p>Rate Limit: {secret.rate_limit.requests_per_minute} requests/minute</p>
                      )}
                      {secret.expires_at && (
                        <p>Expires: {new Date(secret.expires_at).toLocaleDateString()}</p>
                      )}
                      {service.metadata?.models && (
                        <p>Models: {service.metadata.models.join(', ')}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Help Section */}
        <div className={`mt-8 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-xl border p-6`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-500" />
            <span>Security Information</span>
          </h2>
          <div className="space-y-3 text-sm text-gray-500">
            <p>• API keys are encrypted and stored securely in Supabase Vault</p>
            <p>• Keys are never exposed in logs or client-side code</p>
            <p>• Access is restricted to authenticated service roles only</p>
            <p>• All key access is audited for security compliance</p>
            <p>• Keys are automatically loaded from Vault when services start</p>
          </div>
        </div>
      </main>
    </div>
  );
};

// Add missing X import
const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default ApiKeysManager;