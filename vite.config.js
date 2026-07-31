import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build in singolo file: dist/index.html resta apribile col doppio clic,
// senza server e senza file collegati.
export default defineConfig({
    base: './',
    plugins: [viteSingleFile()],
    build: {
        outDir: 'dist',
        cssCodeSplit: false,
        assetsInlineLimit: 100000000
    }
});
