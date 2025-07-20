import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Alert,
  Chip,
  Divider,
  IconButton,
  Collapse
} from '@mui/material';
import { 
  ExpandMore, 
  ExpandLess,
  Warning,
  CheckCircle,
  Error,
  Info
} from '@mui/icons-material';
import { usePerformanceMonitor } from '../../hooks/usePerformanceMonitor';
import { useThree } from '@react-three/fiber';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  target: number;
  status: 'good' | 'warning' | 'critical';
}

interface PerformanceRecommendation {
  level: 'info' | 'warning' | 'error';
  message: string;
  action?: string;
}

export const PerformanceAnalyzer: React.FC = () => {
  const { metrics, qualitySettings } = usePerformanceMonitor();
  const { gl, scene } = useThree();
  const [expanded, setExpanded] = useState(true);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [recommendations, setRecommendations] = useState<PerformanceRecommendation[]>([]);
  const renderInfoRef = useRef<any>({});

  useEffect(() => {
    // Collect render info
    if (gl && gl.info) {
      renderInfoRef.current = {
        triangles: gl.info.render.triangles,
        drawCalls: gl.info.render.calls,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length || 0
      };
    }

    // Calculate performance metrics
    const newMetrics: PerformanceMetric[] = [
      {
        name: 'FPS',
        value: metrics.fps,
        unit: 'fps',
        target: metrics.deviceType === 'mobile' ? 30 : 60,
        status: metrics.fps >= (metrics.deviceType === 'mobile' ? 30 : 55) ? 'good' : 
                metrics.fps >= (metrics.deviceType === 'mobile' ? 20 : 30) ? 'warning' : 'critical'
      },
      {
        name: 'Frame Time',
        value: 1000 / metrics.fps,
        unit: 'ms',
        target: metrics.deviceType === 'mobile' ? 33 : 16,
        status: (1000 / metrics.fps) <= (metrics.deviceType === 'mobile' ? 40 : 20) ? 'good' :
                (1000 / metrics.fps) <= (metrics.deviceType === 'mobile' ? 50 : 33) ? 'warning' : 'critical'
      },
      {
        name: 'Memory Usage',
        value: metrics.memory.percentage,
        unit: '%',
        target: 70,
        status: metrics.memory.percentage <= 50 ? 'good' :
                metrics.memory.percentage <= 75 ? 'warning' : 'critical'
      },
      {
        name: 'Draw Calls',
        value: renderInfoRef.current.drawCalls || 0,
        unit: '',
        target: metrics.deviceType === 'mobile' ? 50 : 100,
        status: (renderInfoRef.current.drawCalls || 0) <= (metrics.deviceType === 'mobile' ? 50 : 100) ? 'good' :
                (renderInfoRef.current.drawCalls || 0) <= (metrics.deviceType === 'mobile' ? 100 : 200) ? 'warning' : 'critical'
      },
      {
        name: 'Triangles',
        value: renderInfoRef.current.triangles || 0,
        unit: '',
        target: metrics.deviceType === 'mobile' ? 50000 : 200000,
        status: (renderInfoRef.current.triangles || 0) <= (metrics.deviceType === 'mobile' ? 50000 : 200000) ? 'good' :
                (renderInfoRef.current.triangles || 0) <= (metrics.deviceType === 'mobile' ? 100000 : 500000) ? 'warning' : 'critical'
      },
      {
        name: 'Textures',
        value: renderInfoRef.current.textures || 0,
        unit: '',
        target: metrics.deviceType === 'mobile' ? 20 : 50,
        status: (renderInfoRef.current.textures || 0) <= (metrics.deviceType === 'mobile' ? 20 : 50) ? 'good' :
                (renderInfoRef.current.textures || 0) <= (metrics.deviceType === 'mobile' ? 40 : 100) ? 'warning' : 'critical'
      }
    ];

    setPerformanceMetrics(newMetrics);

    // Generate recommendations
    const newRecommendations: PerformanceRecommendation[] = [];

    // FPS recommendations
    if (metrics.fps < (metrics.deviceType === 'mobile' ? 25 : 50)) {
      newRecommendations.push({
        level: 'error',
        message: `FPS is critically low (${metrics.fps} fps)`,
        action: 'Consider reducing quality settings or enabling auto-adjustment'
      });
    } else if (metrics.fps < (metrics.deviceType === 'mobile' ? 30 : 60)) {
      newRecommendations.push({
        level: 'warning',
        message: `FPS is below target (${metrics.fps} fps)`,
        action: 'Some quality reductions may improve performance'
      });
    }

    // Memory recommendations
    if (metrics.memory.percentage > 80) {
      newRecommendations.push({
        level: 'error',
        message: `Memory usage is critical (${metrics.memory.percentage.toFixed(0)}%)`,
        action: 'Reduce texture quality or particle count'
      });
    } else if (metrics.memory.percentage > 70) {
      newRecommendations.push({
        level: 'warning',
        message: `Memory usage is high (${metrics.memory.percentage.toFixed(0)}%)`,
        action: 'Monitor for memory leaks or reduce scene complexity'
      });
    }

    // Draw call recommendations
    if (renderInfoRef.current.drawCalls > (metrics.deviceType === 'mobile' ? 100 : 200)) {
      newRecommendations.push({
        level: 'warning',
        message: `High draw call count (${renderInfoRef.current.drawCalls})`,
        action: 'Consider batching geometries or using instanced rendering'
      });
    }

    // Triangle count recommendations
    if (renderInfoRef.current.triangles > (metrics.deviceType === 'mobile' ? 100000 : 500000)) {
      newRecommendations.push({
        level: 'warning',
        message: `High triangle count (${(renderInfoRef.current.triangles / 1000).toFixed(0)}k)`,
        action: 'Use LOD system or simplify geometries'
      });
    }

    // Quality-specific recommendations
    if (qualitySettings.postProcessing && metrics.deviceType === 'mobile') {
      newRecommendations.push({
        level: 'info',
        message: 'Post-processing is enabled on mobile',
        action: 'Consider disabling for better performance'
      });
    }

    if (qualitySettings.particleCount > 500 && metrics.deviceType === 'mobile') {
      newRecommendations.push({
        level: 'info',
        message: 'High particle count on mobile device',
        action: 'Reduce particle count for smoother performance'
      });
    }

    setRecommendations(newRecommendations);
  }, [metrics, qualitySettings, gl, scene]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle sx={{ color: '#4caf50', fontSize: 20 }} />;
      case 'warning':
        return <Warning sx={{ color: '#ff9800', fontSize: 20 }} />;
      case 'critical':
        return <Error sx={{ color: '#f44336', fontSize: 20 }} />;
      default:
        return <Info sx={{ color: '#2196f3', fontSize: 20 }} />;
    }
  };

  const getRecommendationIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <Error sx={{ color: '#f44336', fontSize: 20 }} />;
      case 'warning':
        return <Warning sx={{ color: '#ff9800', fontSize: 20 }} />;
      default:
        return <Info sx={{ color: '#2196f3', fontSize: 20 }} />;
    }
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        top: 20, 
        left: 20, 
        width: 400, 
        maxHeight: '80vh',
        overflow: 'auto',
        zIndex: 1000 
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Performance Analysis</Typography>
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2 }}>
            {/* Device Info */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Device Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip 
                  label={metrics.deviceType} 
                  size="small" 
                  color="primary"
                />
                <Chip 
                  label={`Quality: ${metrics.qualityLevel}`} 
                  size="small"
                />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Performance Metrics */}
            <Typography variant="subtitle2" gutterBottom>
              Performance Metrics
            </Typography>
            <List dense>
              {performanceMetrics.map((metric, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getStatusIcon(metric.status)}
                        <Typography variant="body2">{metric.name}</Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 0.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption">
                            {metric.value.toFixed(metric.unit === '%' ? 1 : 0)}{metric.unit}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Target: {metric.target}{metric.unit}
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min((metric.value / metric.target) * 100, 100)}
                          sx={{ 
                            height: 4,
                            bgcolor: 'grey.300',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: metric.status === 'good' ? '#4caf50' :
                                      metric.status === 'warning' ? '#ff9800' : '#f44336'
                            }
                          }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {recommendations.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Recommendations
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {recommendations.map((rec, index) => (
                    <Alert 
                      key={index}
                      severity={rec.level}
                      icon={getRecommendationIcon(rec.level)}
                      sx={{ py: 0.5 }}
                    >
                      <Typography variant="body2">{rec.message}</Typography>
                      {rec.action && (
                        <Typography variant="caption" color="text.secondary">
                          {rec.action}
                        </Typography>
                      )}
                    </Alert>
                  ))}
                </Box>
              </>
            )}

            {/* Render Stats */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Render Statistics
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Geometries
                </Typography>
                <Typography variant="body2">
                  {renderInfoRef.current.geometries || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Programs
                </Typography>
                <Typography variant="body2">
                  {renderInfoRef.current.programs || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Points
                </Typography>
                <Typography variant="body2">
                  {renderInfoRef.current.points || 0}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Lines
                </Typography>
                <Typography variant="body2">
                  {renderInfoRef.current.lines || 0}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
};