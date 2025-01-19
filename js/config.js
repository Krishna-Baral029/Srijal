// Configuration for the application
const config = {
    // Development (local) server URL
    DEV_SERVER_URL: 'http://localhost:3000',
    
    // Production server URL - Your Render.com backend URL
    PROD_SERVER_URL: 'https://srijal-kb9w.onrender.com',
    
    // Get the appropriate server URL
    get SERVER_URL() {
        // In production, use the current origin (same domain as frontend)
        if (window.location.hostname !== 'localhost') {
            return window.location.origin;
        }
        // For local development
        return this.DEV_SERVER_URL;
    }
};

// Export the config
export default config;
