import { Component, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { reportError } from '@/lib/diagnostics';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { reportError('react_render_failed', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background text-foreground">
      <h1 className="text-xl font-bold">Não foi possível carregar esta tela</h1>
      <button className="flex items-center gap-2 border rounded px-4 py-2" onClick={() => window.location.reload()}><RefreshCw className="h-4 w-4" />Recarregar</button>
    </main>;
  }
}
