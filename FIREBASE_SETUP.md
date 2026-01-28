# Firebase Setup Guide

Follow these steps to set up Firebase for your Art Progression app.

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter a project name (e.g., "art-progression")
4. Disable Google Analytics (optional, not needed)
5. Click "Create project"

## 2. Enable Firestore Database

1. In your Firebase project, go to **Build > Firestore Database**
2. Click "Create database"
3. Choose **Start in test mode** (we'll secure it later)
4. Select a Cloud Firestore location closest to you
5. Click "Enable"

## 3. Set Up Authentication

1. Go to **Build > Authentication**
2. Click "Get started"
3. In the "Sign-in method" tab, click **Google**
4. Toggle "Enable"
5. Select a support email
6. Click "Save"

## 4. Register Your Web App

1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the web icon (`</>`)
4. Enter a nickname (e.g., "Art Progression Web")
5. DON'T check "Firebase Hosting"
6. Click "Register app"
7. Copy the `firebaseConfig` object shown

## 5. Update Your Config

Edit `js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

Also add your Google email to the authorized admins:

```javascript
const AUTHORIZED_ADMINS = [
    "your.email@gmail.com"
];
```

## 6. Add Authorized Domain

Since you're hosting on GitHub Pages:

1. Go to **Authentication > Settings**
2. Click "Authorized domains"
3. Click "Add domain"
4. Add: `yourusername.github.io`

## 7. Secure Firestore (Recommended)

Once testing is complete, update your Firestore rules:

1. Go to **Firestore Database > Rules**
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read artworks
    match /artworks/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

3. Click "Publish"

## 8. Migrate Existing Data (Optional)

If you have existing artworks in `data/artworks.json`, you can migrate them:

1. Sign in to the admin panel
2. Open browser DevTools (F12) > Console
3. Run this script:

```javascript
// Paste your existing artworks here
const existingArtworks = [
  {
    "day": 1,
    "date": "2026-01-05",
    "imageUrl": "https://res.cloudinary.com/...",
    "notes": "First drawing...",
    "uploadedAt": "2026-01-28T17:06:06.655Z"
  }
];

// Migrate to Firestore
const db = firebase.firestore();
for (const artwork of existingArtworks) {
  await db.collection('artworks').add(artwork);
  console.log('Added day', artwork.day);
}
console.log('Migration complete!');
```

## Troubleshooting

### "Sign-in failed" error
- Make sure Google sign-in is enabled in Firebase Authentication
- Check that your domain is in the authorized domains list

### "Permission denied" error
- Check Firestore rules allow read/write
- Make sure you're signed in with an authorized admin account

### Gallery not loading from Firebase
- Check browser console for errors
- Verify the Firebase config values are correct
- Make sure Firestore has data in the `artworks` collection
