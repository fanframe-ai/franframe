import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "./index.css";
import { installGlobalDiagnostics } from '@/lib/diagnostics';
import { ErrorBoundary } from '@/app/ErrorBoundary';

const removeDiagnostics = installGlobalDiagnostics();
import.meta.hot?.dispose(removeDiagnostics);

createRoot(document.getElementById("root")!).render(<ErrorBoundary><App /></ErrorBoundary>);
