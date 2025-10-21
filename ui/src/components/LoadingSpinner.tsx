import React from 'react';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  className = "", 
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-primary ${sizeClasses[size]} ${className}`} />
  );
};

interface MapLoadingSkeletonProps {
  height?: number;
  className?: string;
}

export const MapLoadingSkeleton: React.FC<MapLoadingSkeletonProps> = ({ 
  height = 400,
  className = "" 
}) => (
  <div className={`animate-pulse ${className}`}>
    <div 
      className="w-full bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center"
      style={{ height: `${height}px` }}
    >
      <div className="text-center">
        <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  </div>
);

export default LoadingSpinner;