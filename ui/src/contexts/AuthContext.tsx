import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  isAuthenticated: boolean;
  serviceId: string | null;
  serviceName: string | null;
  apiKey: string | null;
  register: (serviceName: string, serviceType: string) => Promise<void>;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check for stored authentication on mount
  useEffect(() => {
    const storedApiKey = localStorage.getItem('ai_tools_api_key');
    const storedServiceId = localStorage.getItem('ai_tools_service_id');
    const storedServiceName = localStorage.getItem('ai_tools_service_name');

    if (storedApiKey && storedServiceId && storedServiceName) {
      setApiKey(storedApiKey);
      setServiceId(storedServiceId);
      setServiceName(storedServiceName);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const register = async (serviceName: string, serviceType: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_name: serviceName,
          service_type: serviceType,
          capabilities: ['memory', 'tools', 'context', 'knowledge']
        }),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      
      // Store authentication data
      localStorage.setItem('ai_tools_api_key', data.api_key);
      localStorage.setItem('ai_tools_service_id', data.service_id);
      localStorage.setItem('ai_tools_service_name', data.service_name);
      
      setApiKey(data.api_key);
      setServiceId(data.service_id);
      setServiceName(data.service_name);
      setIsAuthenticated(true);
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (apiKey: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Decode JWT to get service info (in production, validate with backend)
      const payload = JSON.parse(atob(apiKey.split('.')[1]));
      
      // Verify the API key by making a test request
      const response = await fetch(`${import.meta.env.VITE_API_URL}/health`, {
        headers: {
          'X-API-Key': apiKey,
          'X-AI-Service': payload.service_name
        }
      });

      if (!response.ok) {
        throw new Error('Invalid API key');
      }
      
      // Store authentication data
      localStorage.setItem('ai_tools_api_key', apiKey);
      localStorage.setItem('ai_tools_service_id', payload.service_id);
      localStorage.setItem('ai_tools_service_name', payload.service_name);
      
      setApiKey(apiKey);
      setServiceId(payload.service_id);
      setServiceName(payload.service_name);
      setIsAuthenticated(true);
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('ai_tools_api_key');
    localStorage.removeItem('ai_tools_service_id');
    localStorage.removeItem('ai_tools_service_name');
    
    setApiKey(null);
    setServiceId(null);
    setServiceName(null);
    setIsAuthenticated(false);
    
    navigate('/login');
  };

  const value = {
    isAuthenticated,
    serviceId,
    serviceName,
    apiKey,
    register,
    login,
    logout,
    loading,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}