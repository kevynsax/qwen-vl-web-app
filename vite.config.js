import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/v1': {
                target: 'https://qwenvl.kevyn.com.br',
                changeOrigin: true,
                secure: true,
            },
        },
    },
});
