
// Global variables
let currentUser = null;
let currentUserType = null;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5000'}/api`;

// Video call variables
let localStream = null;
let remoteStream = null;
let isMicEnabled = true;
let isCameraEnabled = true;
let callDuration = 0;
let callTimer = null;

// Page Management
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // Show selected page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    }
}

function showDashboardSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });

    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
    }

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Find and activate the corresponding nav item
    const navItem = document.querySelector(`[onclick="showDashboardSection('${sectionId}')"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Utility functions
function showAlert(message, type = 'error') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    const container = document.querySelector('.auth-container') || 
                     document.querySelector('.dashboard-container') || 
                     document.body;
    const firstChild = container.firstChild;
    container.insertBefore(alertDiv, firstChild);

    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

function getToken() {
    return localStorage.getItem('token');
}

function saveToken(token) {
    localStorage.setItem('token', token);
}

function saveUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
    currentUser = user;
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    currentUserType = null;
    window.location.href = 'index.html';
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        },
        ...options
    };

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Request failed:', error);
        throw error;
    }
}

// Auth functions
async function handleLogin(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const email = formData.get('email');
    const password = formData.get('password');

    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        saveToken(data.token);
        saveUser({
            id: data.userId,
            role: data.role,
            firstName: data.firstName,
            lastName: data.lastName
        });
        currentUserType = data.role;

        showAlert('Login successful!', 'success');

        // Redirect based on role
        setTimeout(() => {
            switch (data.role) {
                case 'admin':
                    window.location.href = 'index.html#admin';
                    break;
                case 'doctor':
                    window.location.href = 'index.html#doctor';
                    break;
                case 'patient':
                    window.location.href = 'index.html#patient';
                    break;
                default:
                    window.location.href = 'index.html';
            }
        }, 1000);

    } catch (error) {
        showAlert(error.message);
    }
}

async function handleRegister(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (password !== confirmPassword) {
        showAlert('Passwords do not match');
        return;
    }

    const userData = {
        email: formData.get('email'),
        password: password,
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        phone: formData.get('phone'),
        role: formData.get('role') || 'patient'
    };

    // Add doctor-specific fields if role is doctor
    if (userData.role === 'doctor') {
        userData.specialty = formData.get('specialty');
        userData.licenseNumber = formData.get('licenseNumber');
    }

    try {
        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        showAlert('Registration successful! Please login.', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        showAlert(error.message);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const email = formData.get('email');

    try {
        await apiRequest('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });

        showAlert('Password reset link sent to your email!', 'success');
        closeModal('forgotPasswordModal');

    } catch (error) {
        showAlert(error.message);
    }
}

// Doctor fields toggle
function toggleDoctorFields() {
    const role = document.querySelector('input[name="role"]:checked').value;
    const specialtyGroup = document.getElementById('specialtyGroup');
    const licenseGroup = document.getElementById('licenseGroup');

    if (role === 'doctor') {
        specialtyGroup.style.display = 'block';
        licenseGroup.style.display = 'block';
        document.getElementById('specialty').required = true;
        document.getElementById('licenseNumber').required = true;
    } else {
        specialtyGroup.style.display = 'none';
        licenseGroup.style.display = 'none';
        document.getElementById('specialty').required = false;
        document.getElementById('licenseNumber').required = false;
    }
}

function showForgotPassword() {
    openModal('forgotPasswordModal');
}

// Dashboard functions
async function loadPatientDashboard() {
    updateUserInfo();
    await loadPatientAppointments();
    await loadDoctorsForSelect();
}

async function loadDoctorDashboard() {
    updateUserInfo();
    await loadDoctorAppointments();
}

async function loadAdminDashboard() {
    updateUserInfo();
    await loadAdminStats();
    await loadPendingDoctors();
}

function updateUserInfo() {
    const user = getUser();
    if (user) {
        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(el => {
            el.textContent = `${user.firstName} ${user.lastName}`;
        });
    }
}

// Appointment functions
async function loadPatientAppointments() {
    try {
        const appointments = await apiRequest('/appointments/patient');
        displayPatientAppointments(appointments);
        updatePatientStats(appointments);
    } catch (error) {
    console.error('Failed to load appointments:', error);
           
        const container = document.getElementById('patientAppointmentsList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load appointments</p>';
        }
    }
}

async function loadDoctorAppointments() {
    try {
        const appointments = await apiRequest('/appointments/doctor');
        displayDoctorAppointments(appointments);
        updateDoctorStats(appointments);
    } catch (error) {
        console.error('Failed to load appointments:', error);
        const container = document.getElementById('doctorAppointmentsList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load appointments</p>';
        }
    }
}

function displayPatientAppointments(appointments) {
    const container = document.getElementById('patientAppointmentsList');
    if (!container) return;

    if (appointments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #6b7280;">
                <i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No appointments found</p>
                <button onclick="openModal('appointmentModal')" class="btn btn-primary" style="margin-top: 1rem;">
                    Book Your First Appointment
                </button>
            </div>
        `;
        return;
    }

    const appointmentsHTML = appointments.map(appointment => `
        <div class="appointment-item">
            <div style="flex: 1;">
                <h4>Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}</h4>
                <p><i class="fas fa-calendar"></i> ${formatDate(appointment.appointmentDate)}</p>
                <p><i class="fas fa-clock"></i> ${appointment.appointmentTime}</p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="status-badge status-${appointment.status}">${appointment.status}</span>
                <button onclick="startVideoCall()" class="btn btn-primary btn-sm">
                    <i class="fas fa-video"></i> Join Call
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = appointmentsHTML;
}

function displayDoctorAppointments(appointments) {
    const container = document.getElementById('doctorAppointmentsList');
    if (!container) return;

    if (appointments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #6b7280;">
                <i class="fas fa-calendar-alt" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No appointments scheduled</p>
            </div>
        `;
        return;
    }

    const appointmentsHTML = appointments.map(appointment => `
        <div class="appointment-item">
            <div style="flex: 1;">
                <h4>${appointment.patient.firstName} ${appointment.patient.lastName}</h4>
                <p><i class="fas fa-calendar"></i> ${formatDate(appointment.appointmentDate)}</p>
                <p><i class="fas fa-clock"></i> ${appointment.appointmentTime}</p>
                <p>Type: ${appointment.appointmentType}</p>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="status-badge status-${appointment.status}">${appointment.status}</span>
                <button onclick="startVideoCall()" class="btn btn-primary btn-sm">
                    <i class="fas fa-video"></i> Start Call
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = appointmentsHTML;
}

function updatePatientStats(appointments) {
    const element = document.getElementById('patientAppointments');
    if (element) {
        element.textContent = appointments.length;
    }
}

function updateDoctorStats(appointments) {
    const today = new Date().toDateString();
    const todayAppointments = appointments.filter(apt => 
        new Date(apt.appointmentDate).toDateString() === today
    );

    const totalElement = document.getElementById('doctorTotalAppointments');
    const todayElement = document.getElementById('doctorTodayAppointments');
    
    if (totalElement) totalElement.textContent = appointments.length;
    if (todayElement) todayElement.textContent = todayAppointments.length;
}

async function loadDoctorsForSelect() {
    try {
        const doctors = await apiRequest('/doctors');
        const select = document.getElementById('doctorSelect');
        
        if (select) {
            select.innerHTML = '<option value="">Choose a doctor...</option>';
            doctors.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor.user._id;
                option.textContent = `Dr. ${doctor.user.firstName} ${doctor.user.lastName} - ${doctor.specialty}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load doctors:', error);
    }
}

async function bookAppointment(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const appointmentData = {
        doctorId: formData.get('doctorId'),
        appointmentDate: formData.get('appointmentDate'),
        appointmentTime: formData.get('appointmentTime'),
        appointmentType: formData.get('appointmentType'),
        symptoms: formData.get('symptoms')
    };

    try {
        await apiRequest('/appointments', {
            method: 'POST',
            body: JSON.stringify(appointmentData)
        });

        showAlert('Appointment booked successfully!', 'success');
        closeModal('appointmentModal');

        // Refresh appointments list
        await loadPatientAppointments();

        // Reset form
        event.target.reset();
    } catch (error) {
        showAlert(error.message);
    }
}

// Admin functions
async function loadAdminStats() {
    try {
        const stats = await apiRequest('/admin/stats');
        updateAdminStats(stats);
    } catch (error) {
        console.error('Failed to load admin stats:', error);
    }
}

function updateAdminStats(stats) {
    const elements = {
        totalPatients: document.getElementById('totalPatients'),
        totalDoctors: document.getElementById('totalDoctors'),
        pendingDoctors: document.getElementById('pendingDoctors'),
        totalAppointments: document.getElementById('totalAppointments')
    };

    if (elements.totalPatients) elements.totalPatients.textContent = stats.totalPatients || 0;
    if (elements.totalDoctors) elements.totalDoctors.textContent = stats.totalDoctors || 0;
    if (elements.pendingDoctors) elements.pendingDoctors.textContent = stats.pendingDoctors || 0;
    if (elements.totalAppointments) elements.totalAppointments.textContent = stats.totalAppointments || 0;
}

async function loadPendingDoctors() {
    try {
        const pendingDoctors = await apiRequest('/admin/doctors/pending');
        displayPendingDoctors(pendingDoctors);
    } catch (error) {
        console.error('Failed to load pending doctors:', error);
        const container = document.getElementById('pendingDoctorsList');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #ef4444;">Failed to load pending doctors</p>';
        }
    }
}

function displayPendingDoctors(pendingDoctors) {
    const container = document.getElementById('pendingDoctorsList');
    if (!container) return;

    if (pendingDoctors.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #6b7280;">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5; color: #10b981;"></i>
                <p>No pending doctor approvals</p>
            </div>
        `;
        return;
    }

    const doctorsHTML = pendingDoctors.map(doctor => `
        <div class="appointment-item">
            <div style="flex: 1;">
                <h4>Dr. ${doctor.user.firstName} ${doctor.user.lastName}</h4>
                <p><i class="fas fa-stethoscope"></i> ${doctor.specialty}</p>
                <p><i class="fas fa-id-card"></i> License: ${doctor.licenseNumber}</p>
                <p><i class="fas fa-envelope"></i> ${doctor.user.email}</p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="approveDoctor('${doctor._id}')" class="btn btn-success btn-sm">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button onclick="rejectDoctor('${doctor._id}')" class="btn btn-danger btn-sm">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = doctorsHTML;
}

async function approveDoctor(doctorId) {
    try {
        await apiRequest(`/admin/doctors/${doctorId}/approve`, {
            method: 'PATCH'
        });
        showAlert('Doctor approved successfully!', 'success');
        await loadAdminDashboard();
    } catch (error) {
        showAlert(error.message);
    }
}

async function rejectDoctor(doctorId) {
    if (confirm('Are you sure you want to reject this doctor application?')) {
        try {
            // In a real application, you would call an API to reject the doctor
            showAlert('Doctor application rejected', 'success');
            await loadPendingDoctors();
        } catch (error) {
            showAlert(error.message);
        }
    }
}

// Video Call functions
async function startVideoCall() {
    try {
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        window.location.href = 'video.html';

    } catch (error) {
        showAlert('Failed to start video call. Please check camera and microphone permissions.');
        console.error('Video call error:', error);
    }
}

function initializeVideoCall() {
    if (localStream) {
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }

        // Start call timer
        startCallTimer();
    }
}

function startCallTimer() {
    callTimer = setInterval(() => {
        callDuration++;
        const minutes = Math.floor(callDuration / 60);
        const seconds = callDuration % 60;
        const durationElement = document.getElementById('callDuration');
        if (durationElement) {
            durationElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function toggleMicrophone() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isMicEnabled = audioTrack.enabled;

            const micBtn = document.getElementById('toggleMic');
            if (micBtn) {
                micBtn.innerHTML = isMicEnabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
                micBtn.classList.toggle('active', !isMicEnabled);
            }
        }
    }
}

function toggleCamera() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isCameraEnabled = videoTrack.enabled;

            const cameraBtn = document.getElementById('toggleCamera');
            if (cameraBtn) {
                cameraBtn.innerHTML = isCameraEnabled ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
                cameraBtn.classList.toggle('active', !isCameraEnabled);
            }
        }
    }
}

function toggleScreen() {
    // Placeholder for screen sharing functionality
    showAlert('Screen sharing feature coming soon!', 'info');
}

function toggleChat() {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.style.display = chatContainer.style.display === 'none' ? 'flex' : 'none';
    }
}

function openSettings() {
    openModal('settingsModal');
}

function applySettings() {
    closeModal('settingsModal');
    showAlert('Settings applied successfully!', 'success');
}

function endCall() {
    openModal('endCallModal');
}

function confirmEndCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
        callDuration = 0;
    }

    closeModal('endCallModal');
    
    // Return to dashboard
    const user = getUser();
    if (user) {
        window.location.href = 'index.html';
    } else {
        window.location.href = 'index.html';
    }
}

// Chat functions
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (chatInput && chatMessages && chatInput.value.trim()) {
        const message = chatInput.value.trim();
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        messageDiv.innerHTML = `
            <span class="message-time">${time}</span>
            <span class="message-text">${message}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        chatInput.value = '';
    }
}

// Modal functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Format date helper
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Check authentication and load appropriate dashboard
function checkAuth() {
    const token = getToken();
    const user = getUser();
    const hash = window.location.hash;

    if (token && user) {
        currentUser = user;
        currentUserType = user.role;

        // Check for specific dashboard requests
        if (hash === '#admin' && user.role === 'admin') {
            showPage('adminDashboard');
            loadAdminDashboard();
        } else if (hash === '#doctor' && user.role === 'doctor') {
            showPage('doctorDashboard');
            loadDoctorDashboard();
        } else if (hash === '#patient' && user.role === 'patient') {
            showPage('patientDashboard');
            loadPatientDashboard();
        } else {
            // Redirect to appropriate dashboard based on role
            switch (user.role) {
                case 'admin':
                    showPage('adminDashboard');
                    loadAdminDashboard();
                    break;
                case 'doctor':
                    showPage('doctorDashboard');
                    loadDoctorDashboard();
                    break;
                case 'patient':
                    showPage('patientDashboard');
                    loadPatientDashboard();
                    break;
                default:
                    showPage('landingPage');
            }
        }
    } else {
        showPage('landingPage');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the video call page
    if (window.location.pathname.includes('video.html')) {
        initializeVideoCall();
        return;
    }

    // Check authentication only on main pages
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        checkAuth();
    }

    // Set minimum date for appointment booking to today
    const appointmentDateInput = document.getElementById('appointmentDate');
    if (appointmentDateInput) {
        const today = new Date().toISOString().split('T')[0];
        appointmentDateInput.min = today;
    }

    // Add event listeners for role change
    const roleInputs = document.querySelectorAll('input[name="role"]');
    roleInputs.forEach(input => {
        input.addEventListener('change', toggleDoctorFields);
    });
});
