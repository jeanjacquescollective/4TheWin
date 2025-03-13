import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        outDir: 'docs',
    },
    assetsInclude: ['**/images/**', '**/favicon/**', '**/**/arte-logo.png'],
});
