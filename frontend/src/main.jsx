import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { TripProvider } from './fx/TripContext.jsx';
import { FireworksProvider } from './fx/Fireworks.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TripProvider>
      <FireworksProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FireworksProvider>
    </TripProvider>
  </StrictMode>
);
