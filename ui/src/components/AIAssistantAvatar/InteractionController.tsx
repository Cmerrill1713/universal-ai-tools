import { useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';

interface InteractionControllerProps {
  children: React.ReactNode;
  onHover?: (isHovered: boolean) => void;
  onClick?: () => void;
}

export function InteractionController({ 
  children, 
  onHover,
  onClick 
}: InteractionControllerProps) {
  const [hovered, setHovered] = useState(false);
  const { gl } = useThree();
  
  useEffect(() => {
    // Change cursor on hover
    if (hovered) {
      gl.domElement.style.cursor = 'pointer';
    } else {
      gl.domElement.style.cursor = 'auto';
    }
    
    return () => {
      gl.domElement.style.cursor = 'auto';
    };
  }, [hovered, gl]);
  
  const handlePointerOver = () => {
    setHovered(true);
    onHover?.(true);
  };
  
  const handlePointerOut = () => {
    setHovered(false);
    onHover?.(false);
  };
  
  const handleClick = () => {
    onClick?.();
  };
  
  return (
    <group
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {children}
    </group>
  );
}