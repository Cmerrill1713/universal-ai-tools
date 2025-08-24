import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircleIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../store/useStore';
import Logger from '../utils/logger';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    defaultModel: string;
    language: string;
  };
}

// Predefined profiles (in a real app, this would come from a database)
const AVAILABLE_PROFILES: UserProfile[] = [
  {
    id: 'christian',
    name: 'Christian Merrill',
    email: 'christian@universalaitools.com',
    avatar: 'CM',
    preferences: {
      theme: 'dark',
      defaultModel: 'lm-studio',
      language: 'en',
    },
  },
  {
    id: 'trista',
    name: 'Trista',
    email: 'trista@universalaitools.com',
    avatar: 'T',
    preferences: {
      theme: 'light',
      defaultModel: 'ollama',
      language: 'en',
    },
  },
];

export const ProfileLogin: React.ComponentType = () => {
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  const store = useStore();
  const setCurrentUser = store?.setCurrentUser;
  const updatePreferences = store?.updatePreferences;
  const addNotification = store?.addNotification;
  const switchUserStorageKey = store?.switchUserStorageKey;
  const saveUserPreferences = store?.saveUserPreferences;

  const handleProfileSelect = useCallback((profileId: string) => {
    setSelectedProfile(profileId);
    setError('');

    // Check if this is first-time setup for this profile
    // In a real app, this would check if password exists in secure storage
    const hasPassword = localStorage.getItem(`password_${profileId}`) !== null;
    setIsFirstTimeSetup(!hasPassword);

    // Clear password fields when switching profiles
    setPassword('');
    setConfirmPassword('');
  }, []);

  const handleLogin = useCallback(async () => {
    if (!selectedProfile) {
      setError('Please select a profile');
      return;
    }

    // For family use - only require password if one was set
    if (isFirstTimeSetup && password) {
      // Optional password for family security
      if (password.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      // Quick family-friendly login
      await new Promise(resolve => setTimeout(resolve, 500));

      const profile = AVAILABLE_PROFILES.find(p => p.id === selectedProfile);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Save optional password for family use
      if (isFirstTimeSetup && password) {
        localStorage.setItem(`password_${profile.id}`, 'password_set');
        Logger.info(`Optional password set for ${profile.name}`);
      }

      // Switch to user-specific storage and load existing preferences
      switchUserStorageKey?.(profile.id);

      // Update store with user information
      setCurrentUser?.({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar,
        isAuthenticated: true,
      });

      // Apply user preferences (these will override any stored preferences with profile defaults)
      updatePreferences?.({
        theme: profile.preferences.theme,
        defaultModel: profile.preferences.defaultModel,
        language: profile.preferences.language,
      });

      // Save the updated preferences to the user-specific storage
      saveUserPreferences?.(profile.id);

      addNotification?.({
        type: 'success',
        message: `Welcome${isFirstTimeSetup ? ' to Universal AI Tools' : ' back'}, ${profile.name}!`,
      });

      Logger.info(`${profile.name} signed in successfully`);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : 'Sign in failed';
      setError(errorMessage);
      Logger.error('Sign in failed:', _error);
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedProfile,
    password,
    confirmPassword,
    isFirstTimeSetup,
    setCurrentUser,
    updatePreferences,
    addNotification,
    switchUserStorageKey,
    saveUserPreferences,
  ]);

  const handleKeyPress = useCallback(
    (_e: React.KeyboardEvent) => {
      if (_e.key === 'Enter' && selectedProfile && !isLoading) {
        // Simple validation for family use - only check if password was started
        if (isFirstTimeSetup && password && password.length < 4) {
          return; // Need at least 4 characters if setting a password
        }
        if (isFirstTimeSetup && password && password !== confirmPassword) {
          return; // Passwords must match if setting one
        }
        handleLogin();
      }
    },
    [selectedProfile, isLoading, isFirstTimeSetup, password, confirmPassword, handleLogin]
  );

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4'>
      {/* Animated Background Elements */}
      <div className='absolute inset-0 overflow-hidden'>
        <motion.div
          className='absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl'
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className='absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl'
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        className='relative z-10 w-full max-w-md'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo and Title */}
        <div className='text-center mb-8'>
          <motion.div
            className='inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mb-4'
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ duration: 0.2 }}
          >
            <SparklesIcon className='w-10 h-10 text-white' />
          </motion.div>
          <h1 className='text-3xl font-bold text-white mb-2'>Universal AI Tools</h1>
          <p className='text-white/70'>Who&apos;s using the app today?</p>
        </div>

        {/* Login Card */}
        <motion.div
          className='bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20'
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {/* Profile Selection */}
          <div className='mb-6'>
            <label className='block text-white/90 text-sm font-medium mb-3'>
              Choose Your Profile
            </label>
            <div className='grid gap-3'>
              {AVAILABLE_PROFILES.map(profile => (
                <motion.button
                  key={profile.id}
                  onClick={() => handleProfileSelect(profile.id)}
                  className={`flex items-center p-4 rounded-xl border transition-all ${
                    selectedProfile === profile.id
                      ? 'border-purple-400 bg-purple-500/20 shadow-lg shadow-purple-500/25'
                      : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className='flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg mr-4'>
                    {profile.avatar}
                  </div>
                  <div className='flex-1 text-left'>
                    <div className='text-white font-medium'>{profile.name}</div>
                    <div className='text-white/60 text-sm'>{profile.email}</div>
                  </div>
                  {selectedProfile === profile.id && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className='w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center'
                    >
                      <div className='w-2 h-2 bg-white rounded-full' />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Password Field */}
          <AnimatePresence>
            {selectedProfile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className='mb-6'
              >
                <label htmlFor='password' className='block text-white/90 text-sm font-medium mb-2'>
                  {isFirstTimeSetup ? 'Password (Optional)' : 'Password'}
                  {isFirstTimeSetup && (
                    <span className='text-white/60 text-xs ml-2'>
                      For family privacy - leave blank to skip
                    </span>
                  )}
                </label>
                <div className='relative'>
                  <input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={_e => setPassword(_e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      isFirstTimeSetup
                        ? 'Optional - set a simple password or leave blank'
                        : 'Enter your password'
                    }
                    className='w-full px-4 py-3 pl-12 pr-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all'
                  />
                  <KeyIcon className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50' />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-4 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80'
                  >
                    {showPassword ? (
                      <EyeSlashIcon className='w-5 h-5' />
                    ) : (
                      <EyeIcon className='w-5 h-5' />
                    )}
                  </button>
                </div>

                {/* Password Confirmation Field - Only show if setting password */}
                <AnimatePresence>
                  {isFirstTimeSetup && password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className='mt-4'
                    >
                      <label
                        htmlFor='confirmPassword'
                        className='block text-white/90 text-sm font-medium mb-2'
                      >
                        Confirm Password
                      </label>
                      <div className='relative'>
                        <input
                          id='confirmPassword'
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={_e => setConfirmPassword(_e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder='Type password again'
                          className='w-full px-4 py-3 pl-12 pr-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-400 focus:bg-white/15 transition-all'
                        />
                        <KeyIcon className='absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50' />
                        <button
                          type='button'
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className='absolute right-4 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white/80'
                        >
                          {showConfirmPassword ? (
                            <EyeSlashIcon className='w-5 h-5' />
                          ) : (
                            <EyeIcon className='w-5 h-5' />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Simple password feedback for family use */}
                <AnimatePresence>
                  {isFirstTimeSetup && password && password.length > 0 && password.length < 4 && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className='mt-2 text-xs text-yellow-400'
                    >
                      At least 4 characters for basic security
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className='mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm'
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Button */}
          <motion.button
            onClick={handleLogin}
            disabled={!selectedProfile || isLoading}
            className={`w-full py-3 px-6 rounded-xl font-medium transition-all flex items-center justify-center space-x-2 ${
              selectedProfile && !isLoading
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:shadow-lg hover:shadow-purple-500/25'
                : 'bg-white/10 text-white/50 cursor-not-allowed'
            }`}
            whileHover={selectedProfile && !isLoading ? { scale: 1.02, y: -1 } : undefined}
            whileTap={selectedProfile && !isLoading ? { scale: 0.98 } : undefined}
          >
            {isLoading ? (
              <>
                <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                <span>Getting started...</span>
              </>
            ) : (
              <>
                <span>{isFirstTimeSetup ? 'Get Started' : 'Continue'}</span>
                <ArrowRightIcon className='w-5 h-5' />
              </>
            )}
          </motion.button>
        </motion.div>

        {/* Footer */}
        <div className='text-center mt-6 text-white/50 text-sm'>
          <p>Secure authentication powered by Universal AI Tools</p>
        </div>
      </motion.div>
    </div>
  );
};

ProfileLogin.displayName = 'ProfileLogin';
