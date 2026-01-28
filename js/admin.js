// Art Progression - Admin Upload with Firebase

class AdminPanel {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.artworks = [];
        this.googleAccessToken = null; // Store for future Google Photos integration

        this.init();
    }

    init() {
        this.initFirebase();
        this.setupEventListeners();
        this.setDefaultDate();
    }

    initFirebase() {
        // Check if Firebase config is set up
        if (!window.FIREBASE_CONFIG || window.FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
            this.showConfigError();
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(window.FIREBASE_CONFIG);
            }
            this.db = firebase.firestore();
            this.auth = firebase.auth();

            // Listen for auth state changes
            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.handleSignIn(user);
                } else {
                    this.handleSignOut();
                }
            });
        } catch (error) {
            console.error('Firebase init error:', error);
            this.showError('login-message', 'Failed to initialize Firebase: ' + error.message);
        }
    }

    showConfigError() {
        const messageEl = document.getElementById('login-message');
        messageEl.innerHTML = `
            <div class="message error">
                <strong>Firebase not configured</strong><br>
                Please update <code>js/firebase-config.js</code> with your Firebase project settings.
            </div>
        `;
        document.getElementById('google-signin-btn').disabled = true;
    }

    setupEventListeners() {
        // Google Sign-In button
        document.getElementById('google-signin-btn').addEventListener('click', () => {
            this.signInWithGoogle();
        });

        // Sign-out button
        document.getElementById('signout-btn').addEventListener('click', () => {
            this.signOut();
        });

        // Upload form
        document.getElementById('upload-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.uploadArtwork();
        });

        // Image preview
        document.getElementById('image').addEventListener('change', (e) => {
            this.previewImage(e.target.files[0]);
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    async signInWithGoogle() {
        const provider = new firebase.auth.GoogleAuthProvider();
        // Request additional scopes for future Google Photos integration
        provider.addScope('https://www.googleapis.com/auth/photoslibrary.readonly');

        try {
            const result = await this.auth.signInWithPopup(provider);
            // Store the access token for Google Photos API
            this.googleAccessToken = result.credential.accessToken;
            sessionStorage.setItem('google_access_token', this.googleAccessToken);
        } catch (error) {
            console.error('Sign-in error:', error);
            this.showError('login-message', 'Sign-in failed: ' + error.message);
        }
    }

    async handleSignIn(user) {
        this.currentUser = user;

        // Check if user is authorized
        if (!this.isAuthorizedAdmin(user.email)) {
            this.showError('login-message', `Access denied. ${user.email} is not authorized.`);
            await this.auth.signOut();
            return;
        }

        // Restore access token from session if available
        this.googleAccessToken = sessionStorage.getItem('google_access_token');

        this.showUploadSection(user);
        await this.loadExistingArtworks();
    }

    handleSignOut() {
        this.currentUser = null;
        this.googleAccessToken = null;
        sessionStorage.removeItem('google_access_token');
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('upload-section').classList.add('hidden');
    }

    isAuthorizedAdmin(email) {
        // If no admins configured, allow anyone (for initial setup)
        if (!window.AUTHORIZED_ADMINS || window.AUTHORIZED_ADMINS.length === 0) {
            console.warn('No authorized admins configured. Allowing all users.');
            return true;
        }
        return window.AUTHORIZED_ADMINS.includes(email);
    }

    showUploadSection(user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('upload-section').classList.remove('hidden');

        // Show user info
        document.getElementById('user-info').innerHTML = `
            <div class="user-badge">
                <img src="${user.photoURL || ''}" alt="" class="user-avatar">
                <span>Signed in as <strong>${user.displayName || user.email}</strong></span>
            </div>
        `;
    }

    async signOut() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Sign-out error:', error);
        }
    }

    async loadExistingArtworks() {
        try {
            const snapshot = await this.db.collection('artworks').get();
            this.artworks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Suggest next day number
            if (this.artworks.length > 0) {
                const maxDay = Math.max(...this.artworks.map(a => a.day));
                document.getElementById('day').value = maxDay + 1;
            } else {
                document.getElementById('day').value = 1;
            }
        } catch (error) {
            console.log('Error loading artworks:', error);
            this.artworks = [];
            document.getElementById('day').value = 1;
        }
    }

    previewImage(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('preview').innerHTML = `
                <img src="${e.target.result}" alt="Preview">
            `;
        };
        reader.readAsDataURL(file);
    }

    async uploadArtwork() {
        const btn = document.getElementById('upload-btn');
        const messageEl = document.getElementById('upload-message');

        const day = parseInt(document.getElementById('day').value);
        const date = document.getElementById('date').value;
        const notes = document.getElementById('notes').value;
        const imageFile = document.getElementById('image').files[0];

        if (!imageFile) {
            this.showError('upload-message', 'Please select an image');
            return;
        }

        // Check for duplicate day
        if (this.artworks.some(a => a.day === day)) {
            this.showError('upload-message', `Day ${day} already exists!`);
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Uploading...';
        messageEl.innerHTML = '';

        try {
            // Upload to Cloudinary
            const imageUrl = await this.uploadToCloudinary(imageFile);

            // Create artwork entry
            const artwork = {
                day: day,
                date: date,
                imageUrl: imageUrl,
                notes: notes,
                uploadedAt: new Date().toISOString(),
                uploadedBy: this.currentUser.email
            };

            // Save to Firestore
            await this.db.collection('artworks').add(artwork);

            // Add to local array
            this.artworks.push(artwork);

            // Show success message
            messageEl.innerHTML = `
                <div class="message success">
                    <strong>Artwork uploaded successfully!</strong><br>
                    Day ${day} has been added to your gallery.
                </div>
            `;

            // Reset form
            document.getElementById('image').value = '';
            document.getElementById('notes').value = '';
            document.getElementById('preview').innerHTML = '';
            document.getElementById('day').value = day + 1;

        } catch (error) {
            console.error('Upload error:', error);
            this.showError('upload-message', 'Upload failed: ' + error.message);
        }

        btn.disabled = false;
        btn.textContent = 'Upload Artwork';
    }

    async uploadToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', window.CLOUDINARY_CONFIG.UPLOAD_PRESET);
        formData.append('folder', 'art-progression');

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${window.CLOUDINARY_CONFIG.CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error('Cloudinary upload failed');
        }

        const data = await response.json();
        return data.secure_url;
    }

    showError(elementId, message) {
        document.getElementById(elementId).innerHTML = `
            <div class="message error">${message}</div>
        `;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});
