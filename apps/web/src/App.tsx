import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { TopBar } from './components/layout/TopBar';
import { Spinner } from './components/ui/misc';
import { LabPage } from './lab/LabPage';
import { useHealth } from './lib/useHealth';

const PlaygroundPage = lazy(() => import('./playground/PlaygroundPage'));

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 font-mono text-xs text-faint">
      <Spinner /> loading
    </div>
  );
}

export function App() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <div className="flex h-full flex-col overflow-hidden">
        <TopBar health={health} />
        <main className="flex min-h-0 flex-1">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/lab/sorting/bubble-sort" replace />} />
              <Route path="/lab" element={<Navigate to="/lab/sorting/bubble-sort" replace />} />
              <Route path="/lab/:module/:algorithm" element={<LabPage health={health} />} />
              <Route path="/playground" element={<PlaygroundPage health={health} />} />
              <Route path="*" element={<Navigate to="/lab" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
