import { useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams as useRRSearchParams, useParams } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(() => ({
    push: (path) => navigate(path),
    replace: (path) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
  }), [navigate]);
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const [searchParams] = useRRSearchParams();
  const searchStr = searchParams.toString();
  return useMemo(() => new URLSearchParams(searchStr), [searchStr]);
}

export { useParams };

