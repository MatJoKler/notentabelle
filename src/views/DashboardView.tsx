import type { View } from '../state/navigation';

export function DashboardView(_props: { setView: (v: View) => void }) {
  return (
    <section className="view">
      <h1 className="view-title">Übersicht</h1>
      <p className="view-placeholder">Das Dashboard entsteht im nächsten Schritt.</p>
    </section>
  );
}
