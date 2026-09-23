import React from 'react';
import {createRoot} from 'react-dom/client';
import '@patternfly/react-core/dist/styles/base.css';
import './styles.css';
import {App} from './App';

const root = document.getElementById('quay-next-root');
if (!root) throw new Error('Quay Next mount point is missing.');
try {
  const theme = localStorage.getItem('quay-next.theme') ?? 'system';
  document.documentElement.classList.toggle('pf-v6-theme-dark', theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches));
} catch {/* Browser preferences may be unavailable. */}
createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
