// Firebase Configuration
// ===========================================
// SETUP REQUIRED: Replace these values with your Firebase project config
// Get these from: Firebase Console > Project Settings > Your apps > Web app
// ===========================================

const firebaseConfig = {
    apiKey: "AIzaSyB2_27ZhSikSQ_EZPqAneFwaspjaJR1KGY",
    authDomain: "art-progression.firebaseapp.com",
    projectId: "art-progression",
    storageBucket: "art-progression.firebasestorage.app",
    messagingSenderId: "359856478292",
    appId: "1:359856478292:web:af02c32a36d9d96cdeb5c1"
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
