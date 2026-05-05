import { Component, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomeScreen } from './components/screens/HomeScreen';
import { SetupScreen } from './components/screens/SetupScreen';
import { GameScreen } from './components/screens/GameScreen';
import { InstructionsScreen } from './components/screens/InstructionsScreen';
import { StatsScreen } from './components/screens/StatsScreen';

// ── Error Boundary ──────────────────────────────────────────────────────────
// Catches unhandled render errors so the page doesn't crash/reload.
// Without this, any uncaught error crashes the React tree and Vite reloads.

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('React Error Boundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A0A',
          color: '#c9a84c',
          fontFamily: "'Cinzel', serif",
          gap: 20,
        }}>
          <h2 style={{ fontSize: 24 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontFamily: "'DM Mono', monospace", fontSize: 14 }}>
            An unexpected error occurred. Click below to reset and return home.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('poker-game-store');
              window.location.href = '/';
            }}
            style={{
              padding: '12px 28px',
              background: 'rgba(201,168,76,0.1)',
              border: '1px solid rgba(201,168,76,0.4)',
              color: '#c9a84c',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: "'DM Mono', monospace",
              fontSize: 14,
            }}
          >
            Reset &amp; Return Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ─────────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/setup" element={<SetupScreen />} />
          <Route path="/game" element={<GameScreen />} />
          <Route path="/instructions" element={<InstructionsScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
