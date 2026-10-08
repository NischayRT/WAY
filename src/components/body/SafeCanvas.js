'use client';

import { Component } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';

/**
 * Drop-in replacement for @react-three/fiber's <Canvas>.
 *
 * Anything that throws inside a Canvas (for example a body model that fails
 * to download) is re-thrown into the surrounding React tree, which took down
 * the whole home page. This boundary contains it: the 3D area shows a short
 * message with a Retry button and the rest of the page keeps working.
 */
class ModelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    // Keep the real cause visible in the browser console for debugging.
    console.error('[3D] model failed to load:', error);
  }

  retry() {
    // useGLTF caches failures too; clear the failed URL so Retry refetches it.
    const match = /load\s+(\S+?):/.exec(String(this.state.error?.message ?? ''));
    if (match) {
      try {
        useGLTF.clear(match[1]);
      } catch {
        /* nothing cached for that URL */
      }
    }
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">The 3D body couldn&apos;t load.</p>
        <p className="text-xs text-slate-400">Check your connection and try again.</p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    );
  }
}

export default function SafeCanvas(props) {
  return (
    <ModelErrorBoundary>
      <Canvas {...props} />
    </ModelErrorBoundary>
  );
}
