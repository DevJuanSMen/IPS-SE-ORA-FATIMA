import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
        plugins: [react()],
        server: {
            host: true,
            port: 5173,
            allowedHosts: ["portal.ipsnuestrasenoradefatima.com"],
            proxy: {
                '/api': {
                    target: env.VITE_API_URL || 'http://localhost:3001',
                    changeOrigin: true
                },
                '/socket.io': {
                    target: env.VITE_API_URL || 'http://localhost:3001',
                    changeOrigin: true,
                    ws: true
                }
            },
            watch: {
                usePolling: true
            }
        }
    }
})
