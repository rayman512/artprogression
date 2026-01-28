// Art Progression - Admin Upload with Firebase

class AdminPanel {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.artworks = [];
        this.googleAccessToken = null; // Store for future Google Photos integration
        this.editingArtwork = null; // Track artwork being edited
        this.deletingArtwork = null; // Track artwork being deleted

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

        // Edit modal events
        document.getElementById('edit-modal-close').addEventListener('click', () => {
            this.closeEditModal();
        });
        document.getElementById('edit-cancel-btn').addEventListener('click', () => {
            this.closeEditModal();
        });
        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateArtwork();
        });

        // Delete modal events
        document.getElementById('delete-cancel-btn').addEventListener('click', () => {
            this.closeDeleteModal();
        });
        document.getElementById('delete-confirm-btn').addEventListener('click', () => {
            this.deleteArtwork();
        });

        // Close modals on backdrop click
        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') {
                this.closeEditModal();
            }
        });
        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target.id === 'delete-modal') {
                this.closeDeleteModal();
            }
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

            // Render the artworks list for editing/deleting
            this.renderArtworksList();
        } catch (error) {
            console.log('Error loading artworks:', error);
            this.artworks = [];
            document.getElementById('day').value = 1;
            this.renderArtworksList();
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

            // Add to local array (with the doc id)
            await this.loadExistingArtworks();

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

    // Render the list of artworks for management
    renderArtworksList() {
        const listEl = document.getElementById('artworks-list');

        if (this.artworks.length === 0) {
            listEl.innerHTML = '<div class="artworks-list-empty">No artworks uploaded yet.</div>';
            return;
        }

        // Sort by day descending (newest first)
        const sortedArtworks = [...this.artworks].sort((a, b) => b.day - a.day);

        listEl.innerHTML = sortedArtworks.map(artwork => `
            <div class="artwork-list-item" data-id="${artwork.id}">
                <img src="${artwork.imageUrl}" alt="Day ${artwork.day}">
                <div class="artwork-list-info">
                    <div class="day">Day ${artwork.day}</div>
                    <div class="date">${this.formatDate(artwork.date)}</div>
                    ${artwork.notes ? `<div class="notes">${artwork.notes}</div>` : ''}
                </div>
                <div class="artwork-list-actions">
                    <button class="btn-icon edit-btn" data-id="${artwork.id}" title="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon btn-danger delete-btn" data-id="${artwork.id}" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners to edit buttons
        listEl.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.openEditModal(id);
            });
        });

        // Add event listeners to delete buttons
        listEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                this.openDeleteModal(id);
            });
        });
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Edit modal methods
    openEditModal(id) {
        const artwork = this.artworks.find(a => a.id === id);
        if (!artwork) return;

        this.editingArtwork = artwork;

        // Populate form
        document.getElementById('edit-id').value = artwork.id;
        document.getElementById('edit-day').value = artwork.day;
        document.getElementById('edit-date').value = artwork.date;
        document.getElementById('edit-notes').value = artwork.notes || '';
        document.getElementById('edit-image-preview').src = artwork.imageUrl;
        document.getElementById('edit-message').innerHTML = '';

        // Show modal
        document.getElementById('edit-modal').classList.remove('hidden');
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.add('hidden');
        this.editingArtwork = null;
    }

    async updateArtwork() {
        if (!this.editingArtwork) return;

        const btn = document.getElementById('edit-save-btn');
        const messageEl = document.getElementById('edit-message');

        const newDay = parseInt(document.getElementById('edit-day').value);
        const newDate = document.getElementById('edit-date').value;
        const newNotes = document.getElementById('edit-notes').value;

        // Check for duplicate day (excluding current artwork)
        if (newDay !== this.editingArtwork.day &&
            this.artworks.some(a => a.day === newDay && a.id !== this.editingArtwork.id)) {
            this.showError('edit-message', `Day ${newDay} already exists!`);
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';
        messageEl.innerHTML = '';

        try {
            // Update in Firestore
            await this.db.collection('artworks').doc(this.editingArtwork.id).update({
                day: newDay,
                date: newDate,
                notes: newNotes,
                updatedAt: new Date().toISOString()
            });

            // Reload artworks and refresh the list
            await this.loadExistingArtworks();

            // Close modal
            this.closeEditModal();

        } catch (error) {
            console.error('Update error:', error);
            this.showError('edit-message', 'Update failed: ' + error.message);
        }

        btn.disabled = false;
        btn.textContent = 'Save Changes';
    }

    // Delete modal methods
    openDeleteModal(id) {
        const artwork = this.artworks.find(a => a.id === id);
        if (!artwork) return;

        this.deletingArtwork = artwork;

        // Populate modal
        document.getElementById('delete-day-text').textContent = `Day ${artwork.day}`;
        document.getElementById('delete-image-preview').src = artwork.imageUrl;
        document.getElementById('delete-message').innerHTML = '';

        // Show modal
        document.getElementById('delete-modal').classList.remove('hidden');
    }

    closeDeleteModal() {
        document.getElementById('delete-modal').classList.add('hidden');
        this.deletingArtwork = null;
    }

    async deleteArtwork() {
        if (!this.deletingArtwork) return;

        const btn = document.getElementById('delete-confirm-btn');
        const messageEl = document.getElementById('delete-message');

        btn.disabled = true;
        btn.textContent = 'Deleting...';
        messageEl.innerHTML = '';

        try {
            // Delete from Firestore
            await this.db.collection('artworks').doc(this.deletingArtwork.id).delete();

            // Reload artworks and refresh the list
            await this.loadExistingArtworks();

            // Close modal
            this.closeDeleteModal();

        } catch (error) {
            console.error('Delete error:', error);
            this.showError('delete-message', 'Delete failed: ' + error.message);
        }

        btn.disabled = false;
        btn.textContent = 'Delete';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});
