import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  View, 
  Flex, 
  ActionButton,
  Text,
  StatusLight,
  Divider,
  Badge
} from '@adobe/react-spectrum';
import * as Icons from '@untitled-ui/icons-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { path: '/athena', label: 'Athena', icon: Icons.Cpu01, badge: '🌟' },
  { path: '/chat', label: 'AI Chat', icon: Icons.MessageSquare01, badge: '🔥' },
  { path: '/vision', label: 'Vision Studio', icon: Icons.Image01 },
  { path: '/mlx', label: 'MLX Training', icon: Icons.CpuChip01 },
  { path: '/orchestration', label: 'AB-MCTS', icon: Icons.GitBranch01 },
  { path: '/monitoring', label: 'Monitoring', icon: Icons.Activity },
  { path: '/models', label: 'Models', icon: Icons.Database01 },
  { path: '/agents', label: 'Agents', icon: Icons.Users01 },
  { path: '/performance', label: 'Performance', icon: Icons.BarChart03 },
];

const Navigation: React.FC = () => {
  const location = useLocation();

  return (
    <View 
      backgroundColor="gray-900" 
      paddingX="size-400" 
      paddingY="size-300"
      borderBottomWidth="thin"
      borderBottomColor="gray-700"
    >
      <Flex justifyContent="space-between" alignItems="center" maxWidth="size-6000" marginX="auto">
        {/* Logo Section */}
        <Flex alignItems="center" gap="size-400">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Flex alignItems="center" gap="size-200">
              <Icons.CpuChip01 size={32} color="#3b82f6" />
              <Text>
                <span style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold',
                  background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Universal AI Tools
                </span>
              </Text>
            </Flex>
          </Link>
          
          <StatusLight variant="positive">
            <Text>Online</Text>
          </StatusLight>
        </Flex>

        {/* Navigation Items */}
        <Flex alignItems="center" gap="size-100">
          {navItems.map(({ path, label, icon: Icon, badge }) => {
            const isActive = location.pathname === path;
            
            return (
              <Link key={path} to={path} style={{ textDecoration: 'none' }}>
                <ActionButton
                  isQuiet={!isActive}
                  variant={isActive ? "accent" : "secondary"}
                  onPress={() => {}}
                  UNSAFE_style={{
                    backgroundColor: isActive ? '#3b82f6' : 'transparent',
                    color: isActive ? 'white' : '#9ca3af',
                    border: isActive ? '1px solid #3b82f6' : '1px solid transparent',
                    position: 'relative'
                  }}
                >
                  <Flex alignItems="center" gap="size-100">
                    <Icon width={18} height={18} />
                    <Text>{label}</Text>
                    {badge && (
                      <Badge variant="info" UNSAFE_style={{ fontSize: '0.75rem' }}>
                        {badge}
                      </Badge>
                    )}
                  </Flex>
                </ActionButton>
              </Link>
            );
          })}
        </Flex>

        {/* Right Side Actions */}
        <Flex alignItems="center" gap="size-200">
          <ActionButton
            isQuiet
            onPress={() => alert('Settings coming soon!')}
            aria-label="Settings"
          >
            <Icons.Settings01 size={20} />
          </ActionButton>
          
          <ActionButton
            isQuiet
            onPress={() => alert('Notifications coming soon!')}
            aria-label="Notifications"
          >
            <Flex alignItems="center">
              <Icons.Bell01 size={20} />
              <View
                position="absolute"
                top="size-25"
                right="size-25"
                width="size-75"
                height="size-75"
                backgroundColor="negative"
                borderRadius="regular"
              />
            </Flex>
          </ActionButton>
          
          <Divider orientation="vertical" size="S" />
          
          <ActionButton
            isQuiet
            onPress={() => alert('User menu coming soon!')}
            aria-label="User menu"
          >
            <Icons.User01 size={20} />
          </ActionButton>
        </Flex>
      </Flex>
    </View>
  );
};

export default Navigation;