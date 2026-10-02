import React from 'react';

export default function Image({ src, alt, fill, priority, unoptimized, className, style, ...props }) {
  const mergedStyle = fill 
    ? { width: '100%', height: '100%', objectFit: 'cover', ...style }
    : style;

  return (
    <img
      src={src}
      alt={alt || ''}
      className={className}
      style={mergedStyle}
      loading={priority ? 'eager' : 'lazy'}
      {...props}
    />
  );
}
