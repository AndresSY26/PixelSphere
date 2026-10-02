import { useNavigate, useLocation, useSearchParams as useRRSearchParams, useParams } from 'react-router-dom';

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path) => navigate(path),
    replace: (path) => navigate(path, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => window.location.reload(),
  };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const [searchParams] = useRRSearchParams();
  return searchParams;
}

export { useParams };
