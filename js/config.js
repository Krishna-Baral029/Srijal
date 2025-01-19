// Configuration for the application
const config = {
    // Development (local) server URL
    DEV_SERVER_URL: 'http://localhost:3000',
    
    // Production server URL - Your Render.com backend URL
    PROD_SERVER_URL: 'https://krisha-x6rt.onrender.com',
    
    // Get the appropriate server URL
    get SERVER_URL() {
        // In production, use the current origin (same domain as frontend)
        return window.location.hostname === 'localhost' 
            ? this.DEV_SERVER_URL 
            : this.PROD_SERVER_URL;
    }
};

// Export the config
export default config;
