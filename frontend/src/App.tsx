import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { MantineProvider, MantineThemeOverride } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { observer } from "mobx-react-lite";
import { useStore } from "./hooks/use-store";
import "@xyflow/react/dist/style.css";

// Lazy load all pages and components
import { Suspense, lazy, Component, ErrorInfo, ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { store, StoreProvider } from "./stores/store-context-provider";

// Lazy load all page
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Dashboard = lazy(() => import("./pages/DashboardPage"));

// Enhanced Loading Component
const LoadingSpinner = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      flexDirection: "column",
      gap: "16px",
    }}
  >
    <div
      style={{
        width: "40px",
        height: "40px",
        border: "4px solid #f3f3f3",
        borderTop: "4px solid rgb(27, 28, 28)",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
    <p style={{ color: "#666", fontSize: "14px" }}>Loading...</p>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Error Boundary for lazy loaded components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyLoadErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Lazy loading error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            flexDirection: "column",
            gap: "16px",
            padding: "20px",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#e74c3c", marginBottom: "8px" }}>
            Something went wrong
          </h2>
          <p style={{ color: "#666", marginBottom: "16px" }}>
            Failed to load the page. Please try refreshing.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3498db",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Enhanced Protected Route with lazy loading support
const ProtectedRoute = observer(
  ({ children }: { children: React.ReactNode }) => {
    const { authStore } = useStore();
    const location = useLocation();

    if (authStore.loading) {
      return <LoadingSpinner />;
    }

    // Use the new isAuthenticated method for better checking
    if (!authStore.user || !authStore.isAuthenticated()) {
      // Store the current location in state to redirect after login
      return <Navigate to="/" state={{ from: location }} replace />;
    }

    return (
      <LazyLoadErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
      </LazyLoadErrorBoundary>
    );
  }
);

// Public Route wrapper for lazy loading
const PublicRoute = ({ children }: { children: React.ReactNode }) => (
  <LazyLoadErrorBoundary>
    <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
  </LazyLoadErrorBoundary>
);

// Mantine theme configuration with high z-index for overlays
const theme: MantineThemeOverride = {
  components: {
    Popover: {
      styles: {
        dropdown: {
          zIndex: 1001,
        },
      },
    },
    Modal: {
      styles: {
        root: {
          zIndex: 1001,
        },
        inner: {
          zIndex: 1001,
        },
      },
    },
    Menu: {
      styles: {
        dropdown: {
          zIndex: 1001,
        },
      },
    },
    Tooltip: {
      styles: {
        tooltip: {
          zIndex: 1001,
        },
      },
    },
    Select: {
      styles: {
        dropdown: {
          zIndex: 1001,
        },
      },
    },
    MultiSelect: {
      styles: {
        dropdown: {
          zIndex: 1001,
        },
      },
    },
  },
};

const App = observer(() => {
  return (
    <QueryClientProvider client={store.queryClient}>
      <StoreProvider>
        <MantineProvider withGlobalStyles withNormalizeCSS theme={theme}>
          <Notifications position="bottom-right" zIndex={2077} />
          <Router>
            <Routes>
              <Route
                path="/"
                element={
                  <PublicRoute>
                    <LandingPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/:pageId"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </MantineProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
});

export default App;
