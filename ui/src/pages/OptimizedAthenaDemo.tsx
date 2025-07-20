import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Grid,
  FormControlLabel,
  Switch,
  Alert,
  Chip
} from '@mui/material';
import { PerformanceOptimizedMovieGradeAthena } from '../components/SweetAthena/Advanced/PerformanceOptimizedMovieGradeAthena';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

const OptimizedAthenaDemo: React.FC = () => {
  const [showAthena, setShowAthena] = useState(true);
  const [showTips, setShowTips] = useState(true);
  const { metrics, qualitySettings } = usePerformanceMonitor();

  return (
    <Container maxWidth={false} sx={{ p: 0, height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <Paper 
        sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          p: 2, 
          zIndex: 10,
          borderRadius: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Grid container alignItems="center" spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="h5" color="white">
              Performance-Optimized Sweet Athena
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Chip 
                label={`Device: ${metrics.deviceType}`} 
                size="small" 
                color="primary"
              />
              <Chip 
                label={`Quality: ${metrics.qualityLevel}`} 
                size="small" 
                color="secondary"
              />
              <Chip 
                label={`FPS: ${metrics.fps}`} 
                size="small" 
                color={metrics.fps >= 55 ? 'success' : metrics.fps >= 30 ? 'warning' : 'error'}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={showAthena} 
                    onChange={(e) => setShowAthena(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show Athena"
                sx={{ color: 'white' }}
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={showTips} 
                    onChange={(e) => setShowTips(e.target.checked)}
                    color="primary"
                  />
                }
                label="Show Tips"
                sx={{ color: 'white' }}
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 3D Scene */}
      {showAthena && (
        <Box sx={{ width: '100%', height: '100%' }}>
          <PerformanceOptimizedMovieGradeAthena />
        </Box>
      )}

      {/* Performance Tips */}
      {showTips && (
        <Paper 
          sx={{ 
            position: 'absolute', 
            bottom: 20, 
            left: 20, 
            maxWidth: 400,
            p: 2,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            color: 'white'
          }}
        >
          <Typography variant="h6" gutterBottom>
            Performance Features
          </Typography>
          
          {metrics.deviceType === 'mobile' ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              Mobile optimizations are active. Quality automatically adjusted for 30+ FPS.
            </Alert>
          ) : (
            <Alert severity="success" sx={{ mb: 2 }}>
              Desktop mode active. Full quality features enabled.
            </Alert>
          )}

          <Typography variant="body2" paragraph>
            Active Optimizations:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <Typography variant="caption">
                Adaptive quality: {qualitySettings.qualityLevel} preset
              </Typography>
            </li>
            <li>
              <Typography variant="caption">
                Particle count: {qualitySettings.particleCount}
              </Typography>
            </li>
            <li>
              <Typography variant="caption">
                Render scale: {(qualitySettings.renderScale * 100).toFixed(0)}%
              </Typography>
            </li>
            <li>
              <Typography variant="caption">
                Post-processing: {qualitySettings.postProcessing ? 'Enabled' : 'Disabled'}
              </Typography>
            </li>
            <li>
              <Typography variant="caption">
                LOD bias: {qualitySettings.lodBias > 0 ? '+' : ''}{qualitySettings.lodBias}
              </Typography>
            </li>
          </ul>

          <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.7 }}>
            The system automatically adjusts quality to maintain target FPS.
            Use the performance controls to override automatic settings.
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default OptimizedAthenaDemo;