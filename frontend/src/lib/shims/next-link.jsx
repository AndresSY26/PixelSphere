import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

export default function Link({ href, to, children, className, ...props }) {
  return (
    <RouterLink to={href || to || '/'} className={className} {...props}>
      {children}
    </RouterLink>
  );
}
