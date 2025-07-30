
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_management', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
};

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
    isApproved: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Doctor Schema
const doctorSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    specialty: { type: String, required: true },
    licenseNumber: { type: String, required: true },
    experienceYears: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 100 },
    availableDays: [{ type: String }],
    availableTimes: [{ type: String }],
    isApproved: { type: Boolean, default: false }
}, { timestamps: true });

// Appointment Schema
const appointmentSchema = new mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointmentDate: { type: Date, required: true },
    appointmentTime: { type: String, required: true },
    appointmentType: { type: String, required: true },
    symptoms: { type: String },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
    consultationFee: { type: Number, default: 100 },
    notes: { type: String }
}, { timestamps: true });

// Password Reset Schema
const passwordResetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

// Models
const User = mongoose.model('User', userSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET || 'hospital-secret-key', (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.user = user;
        next();
    });
};

// Connect to Database
connectDB();

// Routes

// Health Check
app.get('/api', (req, res) => {
    res.json({ message: 'Hospital Management System API is running!' });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role, specialty, licenseNumber } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = new User({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            role: role || 'patient',
            isApproved: role === 'doctor' ? false : true
        });

        await user.save();

        // If doctor, create doctor profile
        if (role === 'doctor') {
            const doctor = new Doctor({
                user: user._id,
                specialty,
                licenseNumber,
                isApproved: false
            });
            await doctor.save();
        }

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check if doctor is approved
        if (user.role === 'doctor' && !user.isApproved) {
            return res.status(403).json({ message: 'Your account is pending approval' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'hospital-secret-key',
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            userId: user._id, 
            role: user.role, 
            firstName: user.firstName, 
            lastName: user.lastName,
            message: 'Logged in successfully' 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// // Forgot Password
// app.post('/api/auth/forgot-password', async (req, res) => {
//     try {
//         const { email } = req.body;

//         const user = await User.findOne({ email, isActive: true });
//         if (!user) {
//             return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
//         }

//         // Generate reset token
//         const resetToken = jwt.sign(
//             { userId: user._id, type: 'password-reset' },
//             process.env.JWT_SECRET || 'hospital-secret-key',
//             { expiresIn: '1h' }
//         );

//         // Save reset token to database
//         await PasswordReset.deleteMany({ userId: user._id });
//         const passwordReset = new PasswordReset({
//             userId: user._id,
//             token: resetToken,
//             expiresAt: new Date(Date.now() + 60 * 60 * 1000)
//         });
//         await passwordReset.save();

//         // In development, log to console
//         console.log(`
//         =============================================
//         PASSWORD RESET EMAIL (Development Mode)
//         =============================================
//         To: ${email}
//         Reset Token: ${resetToken}
//         =============================================
//         `);

//         res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
//     } catch (error) {
//         console.error('Forgot password error:', error);
//         res.status(500).json({ message: 'Server error', error: error.message });
//     }
// });

////////////////////////////////


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email, isActive: true });
        if (!user) {
            return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
        }

        // Generate reset token
        const resetToken = jwt.sign(
            { userId: user._id, type: 'password-reset' },
            process.env.JWT_SECRET || 'hospital-secret-key',
            { expiresIn: '1h' }
        );

        // Save to DB
        await PasswordReset.deleteMany({ userId: user._id });
        const passwordReset = new PasswordReset({
            userId: user._id,
            token: resetToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        });
        await passwordReset.save();

        // Send email
        await transporter.sendMail({
            from: `"Hospital Management" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Password Reset Request",
            html: `
                <p>Hello ${user.firstName},</p>
                <p>You requested a password reset.</p>
                <p><a href="http://localhost:5000/reset-password?token=${resetToken}">Click here to reset your password</a></p>
                <p>This link will expire in 1 hour.</p>
            `
        });

        res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Get Doctors
app.get('/api/doctors', async (req, res) => {
    try {
        const doctors = await Doctor.find({ isApproved: true })
            .populate('user', 'firstName lastName email phone')
            .sort({ createdAt: -1 });

        res.json(doctors);
    } catch (error) {
        console.error('Get doctors error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Book Appointment
app.post('/api/appointments', authenticateToken, async (req, res) => {
    try {
        const { doctorId, appointmentDate, appointmentTime, appointmentType, symptoms } = req.body;

        // Check if doctor exists
        const doctor = await User.findById(doctorId);
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        // Check for existing appointment at the same time
        const existingAppointment = await Appointment.findOne({
            doctor: doctorId,
            appointmentDate: new Date(appointmentDate),
            appointmentTime,
            status: { $in: ['scheduled', 'rescheduled'] }
        });

        if (existingAppointment) {
            return res.status(400).json({ message: 'Time slot already booked' });
        }

        const appointment = new Appointment({
            patient: req.user.userId,
            doctor: doctorId,
            appointmentDate: new Date(appointmentDate),
            appointmentTime,
            appointmentType,
            symptoms
        });

        await appointment.save();
        await appointment.populate([
            { path: 'patient', select: 'firstName lastName email phone' },
            { path: 'doctor', select: 'firstName lastName email phone' }
        ]);

        res.status(201).json(appointment);
    } catch (error) {
        console.error('Book appointment error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get Patient Appointments
app.get('/api/appointments/patient', authenticateToken, async (req, res) => {
    try {
        const appointments = await Appointment.find({ patient: req.user.userId })
            .populate('doctor', 'firstName lastName email phone')
            .sort({ appointmentDate: -1 });

        res.json(appointments);
    } catch (error) {
        console.error('Get patient appointments error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get Doctor Appointments
app.get('/api/appointments/doctor', authenticateToken, async (req, res) => {
    try {
        const appointments = await Appointment.find({ doctor: req.user.userId })
            .populate('patient', 'firstName lastName email phone')
            .sort({ appointmentDate: 1 });

        res.json(appointments);
    } catch (error) {
        console.error('Get doctor appointments error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Admin Routes

// Get Admin Stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const totalPatients = await User.countDocuments({ role: 'patient', isActive: true });
        const totalDoctors = await User.countDocuments({ role: 'doctor', isApproved: true, isActive: true });
        const pendingDoctors = await Doctor.countDocuments({ isApproved: false });
        const totalAppointments = await Appointment.countDocuments();

        res.json({
            totalPatients,
            totalDoctors,
            pendingDoctors,
            totalAppointments
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get Pending Doctors
app.get('/api/admin/doctors/pending', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const pendingDoctors = await Doctor.find({ isApproved: false })
            .populate('user', 'firstName lastName email phone');

        res.json(pendingDoctors);
    } catch (error) {
        console.error('Get pending doctors error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Approve Doctor
app.patch('/api/admin/doctors/:doctorId/approve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const doctor = await Doctor.findByIdAndUpdate(
            req.params.doctorId,
            { isApproved: true },
            { new: true }
        ).populate('user');

        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        await User.findByIdAndUpdate(doctor.user._id, { isApproved: true });

        res.json({ message: 'Doctor approved successfully', doctor });
    } catch (error) {
        console.error('Approve doctor error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create Default Admin User
const createDefaultAdmin = async () => {
    try {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash('admin123', 12);

            const admin = new User({
                email: 'admin@hospital.com',
                password: hashedPassword,
                firstName: 'Hospital',
                lastName: 'Administrator',
                phone: '+1234567890',
                role: 'admin',
                isApproved: true
            });

            await admin.save();
            console.log('✅ Default admin created: admin@hospital.com / admin123');
        }
    } catch (error) {
        console.error('❌ Error creating default admin:', error);
    }
};

// Initialize default admin after DB connection
mongoose.connection.once('open', () => {
    createDefaultAdmin();
});

// Serve HTML files for different routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'registration.html'));
});

app.get('/video', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'video.html'));
});

// Catch all other routes and serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// // Start server
// app.listen(PORT, '0.0.0.0', () => {
//     console.log(`🚀 Hospital Management System running on port ${PORT}`);
//     console.log(`🌐 Access the application at: http://localhost:${PORT}`);
//     console.log(`👨‍⚕️ Admin Login: admin@hospital.com / admin123`);
// });
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: '*',
    }
});

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data.answer);
    });

    socket.on('ice-candidate', (data) => {
        socket.to(data.roomId).emit('ice-candidate', data.candidate);
    });

    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});

// Replace app.listen with:
http.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`🚀 Hospital Management System running on port ${PORT}`);
    console.log(`🌐 Access the application at: http://localhost:${PORT}`);
//     console.log(`👨‍⚕️ Admin Login: admin@hospital.com / admin123`);
});
