import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { createTerminal } from './lib/terminal';
import './styles.css';

async function boot(): Promise<void> {
    await createTerminal();
    const root = document.getElementById('root');
    if (!root) return;
    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
    if ('serviceWorker' in navigator && window.isSecureContext) {
        navigator.serviceWorker
            .register('/sw.js')
            .catch((e) => console.warn('Service worker registration failed:', e));
    }
}

boot().catch((e) => {
    console.error('Failed to start terminal:', e);
    document.body.textContent = `Failed to start the terminal: ${e instanceof Error ? e.message : String(e)}`;
});
