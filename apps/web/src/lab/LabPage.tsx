import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { findAlgorithm } from '@av/shared';

import { ErrorBox } from '../components/ui/misc';
import type { HealthState } from '../lib/useHealth';
import { useIsDesktop } from '../lib/useMediaQuery';
import { AlgorithmView } from './AlgorithmView';
import { ComparePage } from './ComparePage';
import { MobileNav, Sidebar } from './Sidebar';

export function LabPage({ health }: { health: HealthState }) {
  const { module, algorithm: id } = useParams();
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const compare = module === 'sorting' && id === 'compare';
  const algorithm = compare ? undefined : findAlgorithm(id ?? '');
  if (!compare && (!algorithm || algorithm.module !== module)) {
    return <Navigate to="/lab/sorting/bubble-sort" replace />;
  }
  const lab = health.health?.lab;
  return (
    <div className={desktop ? 'flex min-h-0 flex-1' : 'flex min-h-0 flex-1 flex-col'}>
      {desktop ? <Sidebar /> : <MobileNav value={`/lab/${module}/${id}`} onChange={(path) => navigate(path)} />}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {(health.error || (lab && !lab.available)) && (
          <div className="border-b border-line p-2">
            <ErrorBox>{health.error ?? lab?.reason}</ErrorBox>
          </div>
        )}
        {compare ? <ComparePage /> : algorithm && <AlgorithmView key={algorithm.id} algorithm={algorithm} />}
      </div>
    </div>
  );
}
