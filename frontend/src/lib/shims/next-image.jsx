import React, { useState } from 'react';

export default function Image({ src, alt, fill, priority, unoptimized, className, style, onError, ...props }) {
  const [error, setError] = useState(false);

  const mergedStyle = fill 
    ? { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }
    : style;

  if (error || !src) {
    return (
      <div 
        className={className} 
        style={{ ...mergedStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)' }}
      >
        <span className="text-[10px] text-muted-foreground font-mono">PixelSphere</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      className={className}
      style={mergedStyle}
      loading={priority ? 'eager' : 'lazy'}
      onError={(e) => {
        setError(true);
        if (onError) onError(e);
      }}
      {...props}
    />
  );
}
