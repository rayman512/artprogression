// Firebase Configuration
// ===========================================
// SETUP REQUIRED: Replace these values with your Firebase project config
// Get these from: Firebase Console > Project Settings > Your apps > Web app
// ===========================================

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Authorized admin emails (only these Google accounts can upload)
const AUTHORIZED_ADMINS = [
    // Add your Google email(s) here, e.g.:
    // "your.email@gmail.com"
];

// Cloudinary config (keep existing settings)
const CLOUDINARY_CONFIG = {
    CLOUD_NAME: 'db5ptapmj',
    UPLOAD_PRESET: 'art-progression'
};

// Export for use in other modules
window.FIREBASE_CONFIG = firebaseConfig;
window.AUTHORIZED_ADMINS = AUTHORIZED_ADMINS;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
