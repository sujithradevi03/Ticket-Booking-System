// ===== CONFIGURATION =====
const CONFIG = {
    API_URL: 'http://localhost:5000',
    BOOKING_TIMEOUT: 120000,
    MAX_SEATS_PER_BOOKING: 6,
    REFRESH_INTERVAL: 10000,
    THEME: 'dark'
};

// ===== DEBUG MODE =====
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('🔍 [DEBUG]', ...args);
  }
}

// ===== NAVIGATION FUNCTIONS =====
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    // Hide all sections first
    const sections = ['shows', 'admin', 'analytics', 'booking'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
    
    // Show the selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        
        // Update active navigation link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Find and activate the corresponding nav link
        const activeLink = document.querySelector(`.nav-link[onclick*="${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Load data for the section
        if (sectionId === 'shows') {
            eventHandlers.loadShows();
        } else if (sectionId === 'admin') {
            eventHandlers.loadAdminStats();
        } else if (sectionId === 'analytics') {
            showAnalytics();
        }
    }
    
    // Handle booking section separately (it's in modal)
    if (sectionId === 'booking' && STATE.selectedShow) {
        selectShow(STATE.selectedShow.id);
    } else if (sectionId === 'booking') {
        utils.showNotification('Please select a show first', 'info');
        showSection('shows');
    }
}

// Add analytics section function
function showAnalytics() {
    const analyticsSection = document.getElementById('analytics');
    if (!analyticsSection) {
        // Create analytics section if it doesn't exist
        const section = document.createElement('section');
        section.id = 'analytics';
        section.className = 'section';
        section.innerHTML = `
            <div class="section-header">
                <h2><i class="fas fa-chart-bar"></i> Analytics Dashboard</h2>
            </div>
            <div class="analytics-content">
                <div class="admin-card">
                    <h3><i class="fas fa-chart-line"></i> Booking Trends</h3>
                    <div class="chart-placeholder">
                        <p>📈 Advanced analytics coming soon!</p>
                        <p>This would show:</p>
                        <ul>
                            <li>Daily booking trends</li>
                            <li>Most popular shows</li>
                            <li>Revenue analysis</li>
                            <li>Seat occupancy rates</li>
                        </ul>
                    </div>
                </div>
                <div class="admin-card">
                    <h3><i class="fas fa-calendar"></i> Peak Hours</h3>
                    <div class="chart-placeholder">
                        <p>⏰ Peak booking hours visualization</p>
                        <canvas id="analyticsChart" width="400" height="200"></canvas>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after admin section
        const adminSection = document.getElementById('admin');
        if (adminSection) {
            adminSection.parentNode.insertBefore(section, adminSection.nextSibling);
        }
    }
    
    analyticsSection.style.display = 'block';
}

// ===== STATE MANAGEMENT =====
const STATE = {
    shows: [],
    selectedShow: null,
    selectedSeats: [],
    currentBooking: null,
    bookingTimer: null,
    timeLeft: 120,
    user: {
        name: localStorage.getItem('userName') || '',
        email: localStorage.getItem('userEmail') || ''
    },
    filters: {
        category: '',
        sort: 'rating'
    },
    stats: {
        totalShows: 0,
        totalSeats: 0,
        confirmedBookings: 0,
        totalRevenue: 0
    }
};

// ===== DOM ELEMENTS =====
const elements = {
    // Navigation
    navLinks: document.querySelectorAll('.nav-link'),
    
    // Stats
    totalShows: document.getElementById('totalShows'),
    totalSeats: document.getElementById('totalSeats'),
    confirmedBookings: document.getElementById('confirmedBookings'),
    totalRevenue: document.getElementById('totalRevenue'),
    
    // Shows Section
    showsGrid: document.getElementById('showsGrid'),
    categoryFilter: document.getElementById('categoryFilter'),
    sortFilter: document.getElementById('sortFilter'),
    
    // Seat Modal
    seatModal: document.getElementById('seatModal'),
    modalShowImage: document.getElementById('modalShowImage'),
    modalShowName: document.getElementById('modalShowName'),
    modalShowTime: document.getElementById('modalShowTime'),
    modalShowPrice: document.getElementById('modalShowPrice'),
    modalShowRating: document.getElementById('modalShowRating'),
    modalShowDesc: document.getElementById('modalShowDesc'),
    seatMap: document.getElementById('seatMap'),
    selectedSeatsList: document.getElementById('selectedSeatsList'),
    selectionTotal: document.getElementById('selectionTotal'),
    userName: document.getElementById('userName'),
    userEmail: document.getElementById('userEmail'),
    
    // Booking Status
    bookingStatus: document.getElementById('bookingStatus'),
    bookingTimer: document.getElementById('bookingTimer'),
    bookingProgress: document.getElementById('bookingProgress'),
    statusMessage: document.getElementById('statusMessage'),
    confirmBtn: document.getElementById('confirmBtn'),
    
    // Confirmation Modal
    confirmationModal: document.getElementById('confirmationModal'),
    ticketQR: document.getElementById('ticketQR'),
    ticketShow: document.getElementById('ticketShow'),
    ticketSeats: document.getElementById('ticketSeats'),
    ticketTime: document.getElementById('ticketTime'),
    ticketTotal: document.getElementById('ticketTotal'),
    
    // Admin Panel
    adminSection: document.getElementById('admin'),
    newShowName: document.getElementById('newShowName'),
    newShowDesc: document.getElementById('newShowDesc'),
    newShowCategory: document.getElementById('newShowCategory'),
    newShowPrice: document.getElementById('newShowPrice'),
    newShowTime: document.getElementById('newShowTime'),
    newShowSeats: document.getElementById('newShowSeats'),
    liveBookings: document.getElementById('liveBookings'),
    confirmedStats: document.getElementById('confirmedStats'),
    failedStats: document.getElementById('failedStats'),
    revenueStats: document.getElementById('revenueStats')
};

// ===== UTILITY FUNCTIONS =====
const utils = {
    // Format currency
    formatCurrency: (amount) => {
        return `₹${amount?.toLocaleString('en-IN') || 0}`;
    },
    
    // Format date
    formatDate: (dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Date not available';
        }
    },
    
    // Format time remaining
    formatTime: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Show notification
    showNotification: (message, type = 'info') => {
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    },
    
    // Validate email
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Generate random ID
    generateId: () => {
        return Math.random().toString(36).substr(2, 9);
    }
};

// ===== API SERVICE =====
const apiService = {
    // Fetch all shows
    async fetchShows(filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            const url = `${CONFIG.API_URL}/api/shows?${params}`;
            debugLog('Fetching shows from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            debugLog('Shows response:', data);
            return data;
        } catch (error) {
            console.error('Error fetching shows:', error);
            utils.showNotification('Failed to load shows. Please check backend connection.', 'error');
            return { shows: [] };
        }
    },
    
    // Fetch single show
    async fetchShow(id) {
        try {
            const url = `${CONFIG.API_URL}/api/shows/${id}`;
            debugLog('Fetching show from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            debugLog('Show response:', data);
            return data;
        } catch (error) {
            console.error('Error fetching show:', error);
            utils.showNotification('Failed to load show details.', 'error');
            return null;
        }
    },
    
    // Create booking
    async createBooking(showId, seatNumbers, userEmail, userName) {
        try {
            const url = `${CONFIG.API_URL}/api/bookings`;
            debugLog('Creating booking at:', url, { showId, seatNumbers });
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    showId,
                    seatNumbers,
                    userEmail,
                    userName
                })
            });
            
            const data = await response.json();
            debugLog('Booking response:', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Booking failed');
            }
            
            return data;
        } catch (error) {
            console.error('Error creating booking:', error);
            throw error;
        }
    },
    
    // Confirm booking
    async confirmBooking(bookingId) {
        try {
            const url = `${CONFIG.API_URL}/api/bookings/${bookingId}/confirm`;
            debugLog('Confirming booking at:', url);
            
            const response = await fetch(url, {
                method: 'POST'
            });
            
            const data = await response.json();
            debugLog('Confirm response:', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Confirmation failed');
            }
            
            return data;
        } catch (error) {
            console.error('Error confirming booking:', error);
            throw error;
        }
    },
    
    // Get statistics
    async fetchStats() {
        try {
            const url = `${CONFIG.API_URL}/api/stats`;
            debugLog('Fetching stats from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            debugLog('Stats response:', data);
            return data;
        } catch (error) {
            console.error('Error fetching stats:', error);
            return {
                bookings: { confirmed: 0, failed: 0, revenue: 0 },
                shows: { total: 0, totalSeats: 0 },
                revenue: { total: 0 }
            };
        }
    },
    
    // Health check
    async healthCheck() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/health`);
            debugLog('Health check:', response.status);
            return response.ok;
        } catch (error) {
            debugLog('Health check failed:', error);
            return false;
        }
    }
};

// ===== UI UPDATERS =====
const uiUpdaters = {
    // Update statistics display
    updateStats(stats) {
        debugLog('Updating stats:', stats);
        if (elements.totalShows) elements.totalShows.textContent = stats.shows?.total || 0;
        if (elements.totalSeats) elements.totalSeats.textContent = stats.shows?.totalSeats || 0;
        if (elements.confirmedBookings) elements.confirmedBookings.textContent = stats.bookings?.confirmed || 0;
        if (elements.totalRevenue) elements.totalRevenue.textContent = utils.formatCurrency(stats.revenue?.total || 0);
    },
    
    // Update admin stats
    updateAdminStats(stats) {
        debugLog('Updating admin stats:', stats);
        if (elements.liveBookings) {
            const active = (stats.bookings?.totalBookings || 0) - ((stats.bookings?.confirmed || 0) + (stats.bookings?.failed || 0));
            elements.liveBookings.textContent = Math.max(0, active);
        }
        if (elements.confirmedStats) elements.confirmedStats.textContent = stats.bookings?.confirmed || 0;
        if (elements.failedStats) elements.failedStats.textContent = stats.bookings?.failed || 0;
        if (elements.revenueStats) elements.revenueStats.textContent = utils.formatCurrency(stats.revenue?.total || 0);
    },
    
    // Render shows grid
    renderShows(shows) {
        if (!elements.showsGrid) return;
        
        debugLog('Rendering shows:', shows.length);
        
        if (shows.length === 0) {
            elements.showsGrid.innerHTML = `
                <div class="no-shows">
                    <i class="fas fa-film"></i>
                    <h3>No shows available</h3>
                    <p>Check back later or create new shows in Admin panel</p>
                </div>
            `;
            return;
        }
        
        elements.showsGrid.innerHTML = shows.map(show => `
            <div class="show-card" data-show-id="${show.id}">
                <img src="${show.image || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=200&fit=crop'}" 
                     alt="${show.name}" 
                     class="show-image"
                     onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=200&fit=crop'">
                <div class="show-content">
                    <div class="show-header">
                        <h3>${show.name}</h3>
                        <span class="show-badge">${show.category || 'Movie'}</span>
                    </div>
                    <div class="show-meta">
                        <span><i class="far fa-clock"></i> 2h 30m</span>
                        <span><i class="fas fa-calendar"></i> ${utils.formatDate(show.startTime)}</span>
                        <span><i class="fas fa-star"></i> ${show.rating || 4.5}/5</span>
                    </div>
                    <p class="show-desc">${show.description || 'An amazing cinematic experience'}</p>
                    <div class="show-footer">
                        <div class="show-price">${utils.formatCurrency(show.price || 300)}</div>
                        <div class="show-availability">
                            <span class="available-seats">${show.availableSeats || 0} seats left</span>
                        </div>
                        <button class="btn-book" onclick="selectShow('${show.id}')">
                            <i class="fas fa-ticket-alt"></i> Book Now
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // Render seat map
    renderSeatMap(seatMap, selectedSeats = []) {
        if (!elements.seatMap) return;
        
        debugLog('Rendering seat map:', seatMap);
        
        let html = '';
        
        // Group seats by row
        const rows = seatMap || {};
        
        Object.keys(rows).forEach(rowKey => {
            const seats = rows[rowKey];
            html += `
                <div class="seat-row">
                    <div class="row-label">${rowKey}</div>
                    <div class="seats">
                        ${seats.map(seat => {
                            let seatClass = 'seat';
                            let isSelected = selectedSeats.includes(seat.seatNumber);
                            
                            if (isSelected) {
                                seatClass += ' selected';
                            } else if (seat.status === 'AVAILABLE') {
                                seatClass += ' available';
                            } else if (seat.status === 'BOOKED') {
                                seatClass += ' booked';
                            } else if (seat.status === 'PENDING') {
                                seatClass += ' booked'; // Show as booked for pending
                            }
                            
                            // Mark first 2 rows as VIP
                            if (seat.isVip) {
                                seatClass += ' vip';
                            }
                            
                            return `
                                <div class="${seatClass}" 
                                     data-seat-number="${seat.seatNumber}"
                                     data-seat-status="${seat.status}"
                                     onclick="toggleSeat('${seat.seatNumber}', '${seat.status}')">
                                    <span>${seat.number}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        elements.seatMap.innerHTML = html;
    },
    
    // Update selected seats display
    updateSelectedSeatsDisplay(selectedSeats, show) {
        if (!elements.selectedSeatsList || !elements.selectionTotal) return;
        
        // Update selected seats list
        elements.selectedSeatsList.innerHTML = selectedSeats.map(seat => 
            `<span class="seat-tag">${seat}</span>`
        ).join('');
        
        // Update total price
        const totalPrice = selectedSeats.length * (show?.price || 0);
        elements.selectionTotal.textContent = utils.formatCurrency(totalPrice);
    }
};

// ===== EVENT HANDLERS =====
const eventHandlers = {
    // Initialize event listeners
    init() {
        debugLog('Initializing event handlers');
        
        // Navigation
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href')?.substring(1) || 'shows';
                this.handleNavigation(target);
            });
        });
        
        // Filters
        if (elements.categoryFilter) {
            elements.categoryFilter.addEventListener('change', (e) => {
                STATE.filters.category = e.target.value;
                this.loadShows();
            });
        }
        
        if (elements.sortFilter) {
            elements.sortFilter.addEventListener('change', (e) => {
                STATE.filters.sort = e.target.value;
                this.loadShows();
            });
        }
        
        // User info persistence
        if (elements.userName) {
            elements.userName.value = STATE.user.name;
            elements.userName.addEventListener('input', (e) => {
                STATE.user.name = e.target.value;
                localStorage.setItem('userName', e.target.value);
            });
        }
        
        if (elements.userEmail) {
            elements.userEmail.value = STATE.user.email;
            elements.userEmail.addEventListener('input', (e) => {
                STATE.user.email = e.target.value;
                localStorage.setItem('userEmail', e.target.value);
            });
        }
        
        // Set default time for admin form
        if (elements.newShowTime) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(19, 0, 0);
            elements.newShowTime.value = tomorrow.toISOString().slice(0, 16);
        }
    },
    
    // Handle navigation
    handleNavigation(target) {
        debugLog('Navigating to:', target);
        
        // Update active nav link
        elements.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${target}`) {
                link.classList.add('active');
            }
        });
        
        // Hide all sections
        document.querySelectorAll('.section, #admin').forEach(section => {
            if (section.id !== 'shows') {
                section.style.display = 'none';
            }
        });
        
        // Show target section
        if (target === 'admin') {
            if (elements.adminSection) {
                elements.adminSection.style.display = 'block';
                this.loadAdminStats();
            }
        } else if (target === 'shows') {
            document.getElementById('shows').style.display = 'block';
            this.loadShows();
        }
    },
    
    // Load shows with filters
    async loadShows() {
        debugLog('Loading shows with filters:', STATE.filters);
        
        try {
            const data = await apiService.fetchShows(STATE.filters);
            STATE.shows = data.shows || [];
            
            // Update stats
            STATE.stats.totalShows = STATE.shows.length;
            STATE.stats.totalSeats = STATE.shows.reduce((sum, show) => sum + (show.totalSeats || 0), 0);
            
            // Render shows
            uiUpdaters.renderShows(STATE.shows);
        } catch (error) {
            console.error('Error in loadShows:', error);
        }
    },
    
    // Load admin statistics
    async loadAdminStats() {
        debugLog('Loading admin stats');
        
        try {
            const stats = await apiService.fetchStats();
            uiUpdaters.updateAdminStats(stats);
        } catch (error) {
            console.error('Error loading admin stats:', error);
        }
    }
};

// ===== MAIN FUNCTIONS =====
// Select a show
async function selectShow(showId) {
    debugLog('Selecting show:', showId);
    
    try {
        const showData = await apiService.fetchShow(showId);
        if (!showData?.success) {
            utils.showNotification('Failed to load show details', 'error');
            return;
        }
        
        STATE.selectedShow = showData.show;
        
        // Update modal with show details
        elements.modalShowImage.src = STATE.selectedShow.image || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=200&fit=crop';
        elements.modalShowName.textContent = STATE.selectedShow.name;
        elements.modalShowTime.textContent = utils.formatDate(STATE.selectedShow.startTime);
        elements.modalShowPrice.textContent = utils.formatCurrency(STATE.selectedShow.price);
        elements.modalShowRating.textContent = `${STATE.selectedShow.rating || 4.5}/5`;
        elements.modalShowDesc.textContent = STATE.selectedShow.description;
        
        // Render seat map
        uiUpdaters.renderSeatMap(STATE.selectedShow.seatMap, STATE.selectedSeats);
        
        // Update selected seats display
        uiUpdaters.updateSelectedSeatsDisplay(STATE.selectedSeats, STATE.selectedShow);
        
        // Show modal
        elements.seatModal.classList.add('active');
        
        debugLog('Show loaded successfully:', STATE.selectedShow);
    } catch (error) {
        console.error('Error selecting show:', error);
        utils.showNotification('Failed to load show details.', 'error');
    }
}

// Close seat modal
function closeSeatModal() {
    elements.seatModal.classList.remove('active');
    STATE.selectedSeats = [];
    debugLog('Seat modal closed');
}

// Toggle seat selection
function toggleSeat(seatNumber, status) {
    debugLog('Toggling seat:', seatNumber, status);
    
    if (status !== 'AVAILABLE') {
        utils.showNotification(`Seat ${seatNumber} is not available`, 'error');
        return;
    }
    
    const index = STATE.selectedSeats.indexOf(seatNumber);
    
    if (index > -1) {
        // Deselect seat
        STATE.selectedSeats.splice(index, 1);
        utils.showNotification(`Seat ${seatNumber} deselected`, 'info');
    } else {
        // Select seat
        if (STATE.selectedSeats.length >= CONFIG.MAX_SEATS_PER_BOOKING) {
            utils.showNotification(`Maximum ${CONFIG.MAX_SEATS_PER_BOOKING} seats per booking`, 'error');
            return;
        }
        
        STATE.selectedSeats.push(seatNumber);
        utils.showNotification(`Seat ${seatNumber} selected`, 'success');
    }
    
    // Update UI
    uiUpdaters.renderSeatMap(STATE.selectedShow?.seatMap || {}, STATE.selectedSeats);
    uiUpdaters.updateSelectedSeatsDisplay(STATE.selectedSeats, STATE.selectedShow);
}

// Process booking
async function processBooking() {
    debugLog('Processing booking');
    
    // Validate user input
    if (!STATE.user.name.trim()) {
        utils.showNotification('Please enter your name', 'error');
        elements.userName.focus();
        return;
    }
    
    if (!STATE.user.email.trim() || !utils.validateEmail(STATE.user.email)) {
        utils.showNotification('Please enter a valid email address', 'error');
        elements.userEmail.focus();
        return;
    }
    
    if (STATE.selectedSeats.length === 0) {
        utils.showNotification('Please select at least one seat', 'error');
        return;
    }
    
    if (!STATE.selectedShow) {
        utils.showNotification('No show selected', 'error');
        return;
    }
    
    try {
        // Create booking
        const bookingData = await apiService.createBooking(
            STATE.selectedShow.id,
            STATE.selectedSeats,
            STATE.user.email,
            STATE.user.name
        );
        
        if (bookingData.success) {
            STATE.currentBooking = bookingData.booking;
            
            // Start countdown timer
            startBookingTimer();
            
            // Show booking status
            showBookingStatus(STATE.currentBooking, STATE.timeLeft);
            
            // Close seat modal
            closeSeatModal();
            
            utils.showNotification('Seats reserved successfully! Confirm within 2 minutes.', 'success');
        }
    } catch (error) {
        utils.showNotification(error.message || 'Booking failed. Please try again.', 'error');
    }
}

// Start booking timer
function startBookingTimer() {
    if (STATE.bookingTimer) {
        clearInterval(STATE.bookingTimer);
    }
    
    STATE.timeLeft = 120;
    
    STATE.bookingTimer = setInterval(() => {
        STATE.timeLeft--;
        
        // Update UI
        if (elements.bookingTimer) {
            elements.bookingTimer.textContent = utils.formatTime(STATE.timeLeft);
        }
        
        if (elements.bookingProgress) {
            elements.bookingProgress.style.width = `${(STATE.timeLeft / 120) * 100}%`;
        }
        
        // Handle expiration
        if (STATE.timeLeft <= 0) {
            clearInterval(STATE.bookingTimer);
            STATE.bookingTimer = null;
            
            if (STATE.currentBooking) {
                STATE.currentBooking.status = 'FAILED';
                showBookingStatus(STATE.currentBooking, 0);
                utils.showNotification('Booking expired. Please try again.', 'error');
            }
        }
    }, 1000);
}

// Show booking status
function showBookingStatus(booking, timeLeft) {
    if (!elements.bookingStatus) return;
    
    elements.bookingStatus.classList.add('active');
    elements.bookingTimer.textContent = utils.formatTime(timeLeft);
    elements.bookingProgress.style.width = `${(timeLeft / 120) * 100}%`;
    
    // Update status message
    let message = '';
    switch (booking.status) {
        case 'PENDING':
            message = 'Seats reserved. Confirm your booking within 2 minutes.';
            elements.confirmBtn.disabled = false;
            break;
        case 'CONFIRMED':
            message = 'Booking confirmed successfully!';
            elements.confirmBtn.disabled = true;
            break;
        case 'FAILED':
            message = 'Booking failed or expired. Please try again.';
            elements.confirmBtn.disabled = true;
            break;
    }
    
    elements.statusMessage.textContent = message;
}

// Hide booking status
function hideBookingStatus() {
    if (elements.bookingStatus) {
        elements.bookingStatus.classList.remove('active');
    }
}

// Confirm booking
async function confirmBooking() {
    if (!STATE.currentBooking) {
        utils.showNotification('No active booking to confirm', 'error');
        return;
    }
    
    try {
        const confirmData = await apiService.confirmBooking(STATE.currentBooking.id);
        
        if (confirmData.success) {
            // Update booking status
            STATE.currentBooking.status = 'CONFIRMED';
            
            // Stop timer
            if (STATE.bookingTimer) {
                clearInterval(STATE.bookingTimer);
                STATE.bookingTimer = null;
            }
            
            // Show confirmation modal
            showConfirmationModal();
            
            // Hide booking status
            hideBookingStatus();
            
            // Update stats
            eventHandlers.loadShows();
            eventHandlers.loadAdminStats();
            
            utils.showNotification('Booking confirmed successfully!', 'success');
        }
    } catch (error) {
        utils.showNotification(error.message || 'Confirmation failed.', 'error');
    }
}

// Show confirmation modal
function showConfirmationModal() {
    if (!elements.confirmationModal) return;
    
    // Update ticket details
    elements.ticketQR.textContent = `TICKET-${utils.generateId().toUpperCase()}`;
    elements.ticketShow.textContent = STATE.selectedShow?.name || 'Movie';
    elements.ticketSeats.textContent = STATE.selectedSeats.join(', ');
    elements.ticketTime.textContent = utils.formatDate(new Date());
    elements.ticketTotal.textContent = utils.formatCurrency(STATE.selectedSeats.length * (STATE.selectedShow?.price || 0));
    
    // Show modal
    elements.confirmationModal.classList.add('active');
}

// Hide confirmation modal
function hideConfirmationModal() {
    if (elements.confirmationModal) {
        elements.confirmationModal.classList.remove('active');
    }
}

// Cancel booking
function cancelBooking() {
    if (STATE.bookingTimer) {
        clearInterval(STATE.bookingTimer);
        STATE.bookingTimer = null;
    }
    
    STATE.currentBooking = null;
    STATE.selectedSeats = [];
    
    hideBookingStatus();
    closeSeatModal();
    
    utils.showNotification('Booking cancelled', 'info');
}

// Create show (admin)
async function createShow() {
    debugLog('Creating new show');
    
    // Validate input
    if (!elements.newShowName.value.trim()) {
        utils.showNotification('Please enter show name', 'error');
        elements.newShowName.focus();
        return;
    }
    
    if (!elements.newShowTime.value) {
        utils.showNotification('Please select show time', 'error');
        elements.newShowTime.focus();
        return;
    }
    
    const seats = parseInt(elements.newShowSeats.value);
    if (isNaN(seats) || seats < 10 || seats > 200) {
        utils.showNotification('Please enter valid seat count (10-200)', 'error');
        elements.newShowSeats.focus();
        return;
    }
    
    const price = parseInt(elements.newShowPrice.value);
    if (isNaN(price) || price < 100 || price > 1000) {
        utils.showNotification('Please enter valid price (100-1000)', 'error');
        elements.newShowPrice.focus();
        return;
    }
    
    try {
        const showData = {
            name: elements.newShowName.value,
            description: elements.newShowDesc.value || 'An amazing show experience',
            category: elements.newShowCategory.value,
            startTime: new Date(elements.newShowTime.value).toISOString(),
            totalSeats: seats,
            price: price
        };
        
        const response = await fetch(`${CONFIG.API_URL}/api/admin/shows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(showData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Reset form
            elements.newShowName.value = '';
            elements.newShowDesc.value = '';
            elements.newShowPrice.value = '';
            elements.newShowSeats.value = '100';
            
            // Set default time to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(19, 0, 0);
            elements.newShowTime.value = tomorrow.toISOString().slice(0, 16);
            
            // Refresh shows list
            eventHandlers.loadShows();
            
            utils.showNotification(`Show "${result.showId}" created successfully!`, 'success');
        } else {
            utils.showNotification(result.error || 'Failed to create show', 'error');
        }
    } catch (error) {
        console.error('Error creating show:', error);
        utils.showNotification('Failed to create show', 'error');
    }
}

// Download ticket
function downloadTicket() {
    utils.showNotification('Ticket download feature would be implemented in production', 'info');
    
    // In a real app, this would generate and download a PDF/Image
    const ticketData = {
        show: elements.ticketShow.textContent,
        seats: elements.ticketSeats.textContent,
        time: elements.ticketTime.textContent,
        total: elements.ticketTotal.textContent,
        qrCode: elements.ticketQR.textContent
    };
    
    debugLog('Ticket data for download:', ticketData);
}

// Close confirmation modal
function closeConfirmation() {
    hideConfirmationModal();
    
    // Reset for next booking
    STATE.currentBooking = null;
    STATE.selectedSeats = [];
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 CineBook Pro - Initializing...');
    
    // Initialize event handlers
    eventHandlers.init();
    
    // Check API health
    const isHealthy = await apiService.healthCheck();
    if (!isHealthy) {
        utils.showNotification('⚠️ Backend server is not responding. Please make sure backend is running on port 5000.', 'error');
    } else {
        utils.showNotification('✅ Connected to backend successfully!', 'success');
    }
    
    // Load initial data
    await eventHandlers.loadShows();
    
    // Load initial stats
    const stats = await apiService.fetchStats();
    uiUpdaters.updateStats(stats);
    
    console.log('🚀 CineBook Pro - Ready!');
});

// ===== GLOBAL EXPORTS =====
window.selectShow = selectShow;
window.closeSeatModal = closeSeatModal;
window.toggleSeat = toggleSeat;
window.processBooking = processBooking;
window.confirmBooking = confirmBooking;
window.cancelBooking = cancelBooking;
window.createShow = createShow;
window.downloadTicket = downloadTicket;
window.closeConfirmation = closeConfirmation;

// ===== NOTIFICATION STYLES =====
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--card-bg);
        border-left: 4px solid var(--primary);
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        display: flex;
        align-items: center;
        gap: 10px;
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 3000;
        max-width: 400px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        border-left-color: var(--success);
    }
    
    .notification.error {
        border-left-color: var(--danger);
    }
    
    .notification.info {
        border-left-color: var(--primary);
    }
    
    .notification i {
        font-size: 1.2rem;
    }
    
    .notification.success i {
        color: var(--success);
    }
    
    .notification.error i {
        color: var(--danger);
    }
    
    .notification.info i {
        color: var(--primary);
    }
    
    .no-shows {
        grid-column: 1 / -1;
        text-align: center;
        padding: 60px 20px;
        background: var(--card-bg);
        border-radius: var(--border-radius);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .no-shows i {
        font-size: 3rem;
        color: var(--text-light);
        margin-bottom: 20px;
        display: block;
    }
    
    .no-shows h3 {
        font-size: 1.5rem;
        margin-bottom: 10px;
    }
    
    .no-shows p {
        color: var(--text-light);
    }
`;

document.head.appendChild(notificationStyles);

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Escape closes modals
    if (e.key === 'Escape') {
        if (elements.seatModal?.classList.contains('active')) {
            closeSeatModal();
        }
        if (elements.confirmationModal?.classList.contains('active')) {
            closeConfirmation();
        }
    }
});