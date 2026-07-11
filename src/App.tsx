import { Shell } from './components/Shell';
import { AppProvider } from './state/AppContext';
import { useSessionBootstrap } from './state/useSessionBootstrap';
import { StartScreen } from './views/StartScreen';

export default function App() {
  const bootstrap = useSessionBootstrap();

  if (bootstrap.state.phase !== 'ready') {
    return <StartScreen bootstrap={bootstrap} />;
  }

  return (
    <AppProvider session={bootstrap.state.session}>
      <Shell />
    </AppProvider>
  );
}
