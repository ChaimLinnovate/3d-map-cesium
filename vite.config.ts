import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium'; // Import the Cesium plugin for Vite

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cesium(), // Add the Cesium plugin to your Vite configuration
  ],
  // Define CESIUM_BASE_URL to tell Cesium where to find its static assets
  // This is crucial for Cesium to load its workers, assets, and widgets correctly.
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  // Configure the development server
  server: {
    port: 3000, // Set the port to 3000
  },
});
