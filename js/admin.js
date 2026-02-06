// Art Progression - Admin Upload with Firebase

class AdminPanel {
    constructor() {
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.artworks = [];
        this.googleAccessToken = null; // Store for Google Photos integration
        this.editingArtwork = null; // Track artwork being edited
        this.deletingArtwork = null; // Track artwork being deleted

        // Google Photos state
        this.googlePhotosAlbums = [];
        this.googlePhotosCurrentAlbum = null;
        this.selectedGooglePhoto = null;
        this.googlePhotoFile = null; // File object from Google Photos

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

        // Google Photos button
        document.getElementById('google-photos-btn').addEventListener('click', () => {
            this.openGooglePhotosModal();
        });

        // Google Photos modal events
        document.getElementById('gp-modal-close').addEventListener('click', () => {
            this.closeGooglePhotosModal();
        });
        document.getElementById('gp-back-btn').addEventListener('click', () => {
            this.showAlbumsView();
        });
        document.getElementById('gp-use-btn').addEventListener('click', () => {
            this.useSelectedPhoto();
        });
        document.getElementById('google-photos-modal').addEventListener('click', (e) => {
            if (e.target.id === 'google-photos-modal') {
                this.closeGooglePhotosModal();
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

            // Render the artworks list for editing/deleting
            this.renderArtworksList();
        } catch (error) {
            console.log('Error loading artworks:', error);
            this.artworks = [];
            this.renderArtworksList();
        }
    }

    // Calculate day number from date based on earliest artwork date
    calculateDayNumber(dateStr) {
        if (this.artworks.length === 0) {
            return 1;
        }

        // Find the earliest date among all artworks
        const earliestDate = this.artworks.reduce((earliest, artwork) => {
            const artworkDate = new Date(artwork.date);
            return artworkDate < earliest ? artworkDate : earliest;
        }, new Date(this.artworks[0].date));

        const targetDate = new Date(dateStr);
        const diffTime = targetDate.getTime() - earliestDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays + 1; // Day 1 is the first day
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

        const date = document.getElementById('date').value;
        const notes = document.getElementById('notes').value;
        const imageFile = document.getElementById('image').files[0] || this.googlePhotoFile;

        if (!imageFile) {
            this.showError('upload-message', 'Please select an image or choose from Google Photos');
            return;
        }

        if (!date) {
            this.showError('upload-message', 'Please select a date');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Uploading...';
        messageEl.innerHTML = '';

        try {
            // Upload to Cloudinary
            const imageUrl = await this.uploadToCloudinary(imageFile);

            // Calculate day number from date
            const day = this.calculateDayNumber(date);

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
                    Added to Day ${day} (${this.formatDate(date)}).
                </div>
            `;

            // Reset form
            document.getElementById('image').value = '';
            document.getElementById('notes').value = '';
            document.getElementById('preview').innerHTML = '';
            this.googlePhotoFile = null; // Clear Google Photos selection
            this.setDefaultDate();

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

        // Sort by date descending (newest first), then by uploadedAt for same date
        const sortedArtworks = [...this.artworks].sort((a, b) => {
            const dateCompare = new Date(b.date) - new Date(a.date);
            if (dateCompare !== 0) return dateCompare;
            return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
        });

        listEl.innerHTML = sortedArtworks.map(artwork => {
            const day = this.calculateDayNumber(artwork.date);
            return `
            <div class="artwork-list-item" data-id="${artwork.id}">
                <img src="${artwork.imageUrl}" alt="Day ${day}">
                <div class="artwork-list-info">
                    <div class="day">Day ${day}</div>
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
        `}).join('');

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

        // Calculate current day number
        const day = this.calculateDayNumber(artwork.date);

        // Populate form
        document.getElementById('edit-id').value = artwork.id;
        document.getElementById('edit-day-display').textContent = `Day ${day}`;
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

        const newDate = document.getElementById('edit-date').value;
        const newNotes = document.getElementById('edit-notes').value;

        if (!newDate) {
            this.showError('edit-message', 'Please select a date');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';
        messageEl.innerHTML = '';

        try {
            // Calculate new day number from date
            const newDay = this.calculateDayNumber(newDate);

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

        // Calculate day number
        const day = this.calculateDayNumber(artwork.date);

        // Populate modal
        document.getElementById('delete-day-text').textContent = `Day ${day} (${this.formatDate(artwork.date)})`;
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

    // ==========================================
    // Google Photos Integration
    // ==========================================

    async openGooglePhotosModal() {
        // Check if we have an access token
        if (!this.googleAccessToken) {
            this.showError('upload-message', 'Please sign out and sign in again to access Google Photos.');
            return;
        }

        // Reset state
        this.googlePhotosCurrentAlbum = null;
        this.selectedGooglePhoto = null;

        // Show modal
        document.getElementById('google-photos-modal').classList.remove('hidden');

        // Load albums
        await this.loadGooglePhotosAlbums();
    }

    closeGooglePhotosModal() {
        document.getElementById('google-photos-modal').classList.add('hidden');
        this.selectedGooglePhoto = null;
        this.googlePhotosCurrentAlbum = null;
    }

    showGooglePhotosLoading(show) {
        document.getElementById('gp-loading').classList.toggle('hidden', !show);
    }

    showGooglePhotosError(message) {
        const errorEl = document.getElementById('gp-error');
        if (message) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    }

    async loadGooglePhotosAlbums() {
        this.showGooglePhotosLoading(true);
        this.showGooglePhotosError(null);
        document.getElementById('gp-albums').innerHTML = '';
        document.getElementById('gp-photos').classList.add('hidden');
        document.getElementById('gp-selected-bar').classList.add('hidden');
        document.getElementById('gp-back-btn').classList.add('hidden');
        document.getElementById('gp-modal-title').textContent = 'Google Photos';

        try {
            const response = await fetch('https://photoslibrary.googleapis.com/v1/albums?pageSize=50', {
                headers: {
                    'Authorization': `Bearer ${this.googleAccessToken}`
                }
            });

            if (response.status === 401) {
                // Token expired, need to re-authenticate
                this.showGooglePhotosError('Session expired. Please sign out and sign in again.');
                this.showGooglePhotosLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch albums');
            }

            const data = await response.json();
            this.googlePhotosAlbums = data.albums || [];

            this.renderAlbums();
        } catch (error) {
            console.error('Error loading albums:', error);
            this.showGooglePhotosError('Failed to load albums: ' + error.message);
        }

        this.showGooglePhotosLoading(false);
    }

    renderAlbums() {
        const container = document.getElementById('gp-albums');
        container.classList.remove('hidden');

        // Add "All Photos" option first
        let html = `
            <div class="gp-album-card" data-album-id="all">
                <div style="width: 100%; aspect-ratio: 1; background: linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%); display: flex; align-items: center; justify-content: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
                <div class="gp-album-info">
                    <div class="gp-album-title">All Photos</div>
                    <div class="gp-album-count">Recent photos</div>
                </div>
            </div>
        `;

        // Add album cards
        this.googlePhotosAlbums.forEach(album => {
            const coverUrl = album.coverPhotoBaseUrl ? `${album.coverPhotoBaseUrl}=w300-h300-c` : '';
            html += `
                <div class="gp-album-card" data-album-id="${album.id}">
                    ${coverUrl ? `<img src="${coverUrl}" alt="${album.title}">` : '<div style="width: 100%; aspect-ratio: 1; background: var(--bg-primary);"></div>'}
                    <div class="gp-album-info">
                        <div class="gp-album-title">${album.title}</div>
                        <div class="gp-album-count">${album.mediaItemsCount || 0} items</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add click handlers
        container.querySelectorAll('.gp-album-card').forEach(card => {
            card.addEventListener('click', () => {
                const albumId = card.dataset.albumId;
                if (albumId === 'all') {
                    this.loadRecentPhotos();
                } else {
                    this.loadAlbumPhotos(albumId);
                }
            });
        });
    }

    async loadRecentPhotos() {
        this.googlePhotosCurrentAlbum = { id: 'all', title: 'All Photos' };
        await this.loadPhotos();
    }

    async loadAlbumPhotos(albumId) {
        const album = this.googlePhotosAlbums.find(a => a.id === albumId);
        this.googlePhotosCurrentAlbum = album || { id: albumId, title: 'Album' };
        await this.loadPhotos(albumId);
    }

    async loadPhotos(albumId = null) {
        this.showGooglePhotosLoading(true);
        this.showGooglePhotosError(null);
        document.getElementById('gp-albums').classList.add('hidden');
        document.getElementById('gp-photos').innerHTML = '';
        document.getElementById('gp-photos').classList.remove('hidden');
        document.getElementById('gp-back-btn').classList.remove('hidden');
        document.getElementById('gp-modal-title').textContent = this.googlePhotosCurrentAlbum?.title || 'Photos';
        document.getElementById('gp-selected-bar').classList.add('hidden');
        this.selectedGooglePhoto = null;

        try {
            let url = 'https://photoslibrary.googleapis.com/v1/mediaItems:search';
            const body = {
                pageSize: 50
            };

            if (albumId) {
                body.albumId = albumId;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.googleAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.status === 401) {
                this.showGooglePhotosError('Session expired. Please sign out and sign in again.');
                this.showGooglePhotosLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch photos');
            }

            const data = await response.json();
            const mediaItems = data.mediaItems || [];

            // Filter to only images
            const photos = mediaItems.filter(item =>
                item.mimeType && item.mimeType.startsWith('image/')
            );

            this.renderPhotos(photos);
        } catch (error) {
            console.error('Error loading photos:', error);
            this.showGooglePhotosError('Failed to load photos: ' + error.message);
        }

        this.showGooglePhotosLoading(false);
    }

    renderPhotos(photos) {
        const container = document.getElementById('gp-photos');

        if (photos.length === 0) {
            container.innerHTML = '<div class="gp-loading"><p>No photos found in this album</p></div>';
            return;
        }

        const html = photos.map(photo => `
            <div class="gp-photo-item" data-photo-id="${photo.id}">
                <img src="${photo.baseUrl}=w200-h200-c" alt="${photo.filename || 'Photo'}">
            </div>
        `).join('');

        container.innerHTML = html;

        // Store photos data for selection
        this.currentPhotos = photos;

        // Add click handlers
        container.querySelectorAll('.gp-photo-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectPhoto(item.dataset.photoId);
            });
        });
    }

    selectPhoto(photoId) {
        const photo = this.currentPhotos.find(p => p.id === photoId);
        if (!photo) return;

        this.selectedGooglePhoto = photo;

        // Update selection UI
        document.querySelectorAll('.gp-photo-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.photoId === photoId);
        });

        // Show selected bar
        const selectedBar = document.getElementById('gp-selected-bar');
        document.getElementById('gp-selected-thumb').src = `${photo.baseUrl}=w100-h100-c`;
        document.getElementById('gp-selected-name').textContent = photo.filename || 'Selected photo';
        selectedBar.classList.remove('hidden');
    }

    showAlbumsView() {
        this.googlePhotosCurrentAlbum = null;
        this.selectedGooglePhoto = null;
        document.getElementById('gp-photos').classList.add('hidden');
        document.getElementById('gp-selected-bar').classList.add('hidden');
        document.getElementById('gp-back-btn').classList.add('hidden');
        document.getElementById('gp-modal-title').textContent = 'Google Photos';
        document.getElementById('gp-albums').classList.remove('hidden');
    }

    async useSelectedPhoto() {
        if (!this.selectedGooglePhoto) return;

        const btn = document.getElementById('gp-use-btn');
        btn.disabled = true;
        btn.textContent = 'Loading...';

        try {
            // Download the photo as a blob
            // Use =d for download or =w2048-h2048 for a reasonable size
            const downloadUrl = `${this.selectedGooglePhoto.baseUrl}=w2048-h2048`;
            const response = await fetch(downloadUrl);

            if (!response.ok) {
                throw new Error('Failed to download photo');
            }

            const blob = await response.blob();

            // Create a File object from the blob
            const filename = this.selectedGooglePhoto.filename || 'google-photo.jpg';
            this.googlePhotoFile = new File([blob], filename, { type: blob.type });

            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('preview').innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px;">
                        Selected from Google Photos
                    </p>
                `;
            };
            reader.readAsDataURL(blob);

            // Clear the file input (since we're using Google Photos)
            document.getElementById('image').value = '';

            // Close the modal
            this.closeGooglePhotosModal();

        } catch (error) {
            console.error('Error downloading photo:', error);
            this.showGooglePhotosError('Failed to download photo: ' + error.message);
        }

        btn.disabled = false;
        btn.textContent = 'Use This Photo';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});
