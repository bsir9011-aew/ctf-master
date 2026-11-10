import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Android and local builds keep /; GitHub Pages is hosted at /ctf-master/.
const pagesBase = process.env.CTF_PAGES_DEPLOY === 'true' ? '/ctf-master/' : '/';

export default defineConfig({ plugins: [react()], base: pagesBase });
