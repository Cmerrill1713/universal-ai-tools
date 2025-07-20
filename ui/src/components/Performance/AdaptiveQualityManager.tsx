import React, { useEffect, useState } from 'react';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { Box, Card, CardContent, Typography, Slider, Switch, Button, Chip } from '@mui/material';
import { Speed, Memory, DevicesOther, Settings } from '@mui/icons-material';

interface AdaptiveQualityManagerProps {
  onQualityChange?: (settings: any) => void;
  showControls?: boolean;
}

export const AdaptiveQualityManager: React.FC<AdaptiveQualityManagerProps> = ({
  onQualityChange,
  showControls = true,
}) => {
  const {
    metrics,
    qualitySettings,
    setQualityPreset,
    setCustomQuality,
    resetAutoQuality,
    isAutoAdjusting,
  } = usePerformanceMonitor();

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (onQualityChange) {
      onQualityChange(qualitySettings);
    }
  }, [qualitySettings, onQualityChange]);

  const getFpsColor = (fps: number) => {
    if (fps >= 55) return '#4caf50';
    if (fps >= 30) return '#ff9800';
    return '#f44336';
  };

  const getMemoryColor = (percentage: number) => {
    if (percentage <= 50) return '#4caf50';
    if (percentage <= 75) return '#ff9800';
    return '#f44336';
  };

  if (!showControls) {
    return null;
  }

  return (
    <Card sx={{ position: 'fixed', bottom: 20, right: 20, width: 350, zIndex: 1000 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Performance Monitor
        </Typography>

        {/* Device Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <DevicesOther sx={{ mr: 1 }} />
          <Typography variant="body2">
            Device: {metrics.deviceType} 
            {metrics.isMobile && ' (Mobile)'}
          </Typography>
          <Chip 
            label={metrics.qualityLevel.toUpperCase()} 
            size="small" 
            sx={{ ml: 'auto' }}
            color={isAutoAdjusting ? 'primary' : 'default'}
          />
        </Box>

        {/* FPS Monitor */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Speed sx={{ mr: 1 }} />
            <Typography variant="body2">FPS: </Typography>
            <Typography 
              variant="body2" 
              sx={{ ml: 'auto', color: getFpsColor(metrics.fps), fontWeight: 'bold' }}
            >
              {metrics.fps} / {metrics.averageFps} avg
            </Typography>
          </Box>
          <Box sx={{ 
            height: 4, 
            bgcolor: 'grey.300', 
            borderRadius: 2,
            overflow: 'hidden' 
          }}>
            <Box sx={{ 
              width: `${Math.min((metrics.fps / 60) * 100, 100)}%`,
              height: '100%',
              bgcolor: getFpsColor(metrics.fps),
              transition: 'width 0.3s'
            }} />
          </Box>
        </Box>

        {/* Memory Monitor */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Memory sx={{ mr: 1 }} />
            <Typography variant="body2">Memory: </Typography>
            <Typography 
              variant="body2" 
              sx={{ ml: 'auto', color: getMemoryColor(metrics.memory.percentage) }}
            >
              {metrics.memory.used.toFixed(0)}MB / {metrics.memory.percentage.toFixed(0)}%
            </Typography>
          </Box>
          <Box sx={{ 
            height: 4, 
            bgcolor: 'grey.300', 
            borderRadius: 2,
            overflow: 'hidden' 
          }}>
            <Box sx={{ 
              width: `${metrics.memory.percentage}%`,
              height: '100%',
              bgcolor: getMemoryColor(metrics.memory.percentage),
              transition: 'width 0.3s'
            }} />
          </Box>
        </Box>

        {/* Quality Presets */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Quality Preset
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {['low', 'medium', 'high', 'ultra'].map(preset => (
              <Button
                key={preset}
                size="small"
                variant={metrics.qualityLevel === preset ? 'contained' : 'outlined'}
                onClick={() => setQualityPreset(preset)}
                sx={{ flex: 1 }}
              >
                {preset}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Auto Adjust Toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2">Auto Adjust Quality</Typography>
          <Switch 
            checked={isAutoAdjusting}
            onChange={(e) => e.target.checked ? resetAutoQuality() : null}
            sx={{ ml: 'auto' }}
          />
        </Box>

        {/* Advanced Settings */}
        <Button 
          startIcon={<Settings />}
          onClick={() => setShowAdvanced(!showAdvanced)}
          fullWidth
          variant="text"
          size="small"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </Button>

        {showAdvanced && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Particle Count: {qualitySettings.particleCount}
            </Typography>
            <Slider
              value={qualitySettings.particleCount}
              onChange={(e, value) => setCustomQuality({ particleCount: value as number })}
              min={50}
              max={3000}
              step={50}
              disabled={isAutoAdjusting}
            />

            <Typography variant="body2" gutterBottom>
              Render Scale: {(qualitySettings.renderScale * 100).toFixed(0)}%
            </Typography>
            <Slider
              value={qualitySettings.renderScale}
              onChange={(e, value) => setCustomQuality({ renderScale: value as number })}
              min={0.5}
              max={1}
              step={0.05}
              disabled={isAutoAdjusting}
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption">Post Processing</Typography>
                <Switch 
                  size="small"
                  checked={qualitySettings.postProcessing}
                  onChange={(e) => setCustomQuality({ postProcessing: e.target.checked })}
                  disabled={isAutoAdjusting}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption">Bloom</Typography>
                <Switch 
                  size="small"
                  checked={qualitySettings.bloom}
                  onChange={(e) => setCustomQuality({ bloom: e.target.checked })}
                  disabled={isAutoAdjusting}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption">Reflections</Typography>
                <Switch 
                  size="small"
                  checked={qualitySettings.reflections}
                  onChange={(e) => setCustomQuality({ reflections: e.target.checked })}
                  disabled={isAutoAdjusting}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="caption">Anti-aliasing</Typography>
                <Switch 
                  size="small"
                  checked={qualitySettings.antialias}
                  onChange={(e) => setCustomQuality({ antialias: e.target.checked })}
                  disabled={isAutoAdjusting}
                />
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};