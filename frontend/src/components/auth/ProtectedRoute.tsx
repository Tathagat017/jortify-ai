import { observer } from "mobx-react-lite";
import { Navigate, useLocation } from "react-router-dom";
import { useStore } from "../../hooks/use-store";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = observer(({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { authStore } = useStore();

  if (authStore.loading) {
    return <div>Loading...</div>;
  }

  if (!authStore.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
});
