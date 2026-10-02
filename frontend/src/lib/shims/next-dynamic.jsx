import React, { lazy, Suspense } from 'react';

export default function dynamic(importFn, options = {}) {
  const LazyComponent = lazy(importFn);
  const Loading = options.loading || (() => null);

  return function DynamicComponent(props) {
    return (
      <Suspense fallback={<Loading />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
