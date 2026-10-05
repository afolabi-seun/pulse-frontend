import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Returns a function that goes back to the previous in-app entry (preserving whatever
 * filters/pagination were on it) when one exists in this session's history, or falls back
 * to a plain navigate to `fallbackHref` for a fresh deep link / hard refresh, where there's
 * nothing real to go back to.
 */
export function useSmartBack(fallbackHref: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallbackHref);
    }
  };
}
