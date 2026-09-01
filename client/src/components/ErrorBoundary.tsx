import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const chunkErrorPattern = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const chunkReloadKey = "healthair-chunk-reload-at";

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (!chunkErrorPattern.test(error.message)) return;
    const lastReload = Number(window.sessionStorage.getItem(chunkReloadKey) ?? 0);
    if (Date.now() - lastReload < 30_000) return;
    window.sessionStorage.setItem(chunkReloadKey, String(Date.now()));
    const latest = new URL(window.location.href);
    latest.searchParams.set("refresh", String(Date.now()));
    window.location.replace(latest.toString());
  }

  private reloadLatest = () => {
    const latest = new URL(window.location.href);
    latest.searchParams.set("refresh", String(Date.now()));
    window.location.replace(latest.toString());
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-3">Tampilan perlu diperbarui.</h2>
            <p className="mb-6 text-center text-muted-foreground">
              Versi terbaru HealthAir sudah tersedia. Muat ulang halaman untuk melanjutkan.
            </p>

            <button
              onClick={this.reloadLatest}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Muat ulang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
