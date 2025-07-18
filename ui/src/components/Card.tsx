import React from 'react';
import { cn } from '../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-gray-800 rounded-lg border border-gray-700 shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}