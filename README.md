🏥 Hospital Management System (HMS) – MediCare

A real-time video consultation platform for hospitals and clinics. Built using **Node.js**, **Socket.io**, **MongoDB**, and **HTML/CSS/JS**, this system allows healthcare professionals and patients to engage in secure, web-based video consultations with integrated chat and call controls.

 🚀 Features

🎥 **Video Consultation**: Live video call between doctor and patient.
💬 **Chat Messaging**: Real-time messaging during video consultations.
🎙️ **Call Controls**: Toggle camera, microphone, screen sharing, and end call.
👩‍⚕️ **Doctor Profile Overlay**: Shows doctor’s name and specialization during call.
🛠️ **Settings Modal**: Change camera, microphone, and speaker in real-time.
⚙️ **Admin Panel (WIP)**: Backend stats and dashboard view.
🔐 **Environment Variable Handling** with `.env`.



 🛠️ Tech Stack

| Technology   | Purpose                            |
|--------------|-------------------------------------|
| **Node.js**  | Backend server                      |
| **Express.js** | REST APIs                         |
| **Socket.io**| Real-time communication             |
| **MongoDB**  | Database for users, sessions, etc.  |
| **HTML/CSS/JS** | Frontend UI                      |
| **Font Awesome** | Icons for UI                    |

---

## 📁 Project Structure

HMS/
│
├── frontend/ # Static frontend files (HTML, CSS, JS)
│ ├── index.html # Video consultation UI
│ ├── style.css # Page styling
│ ├── video.js # Socket and media logic
│ └── script.js # UI interaction logic
│
├── server.js # Express + Socket.io backend
├── .env # Environment secrets (ignored by Git)
├── .gitignore # Git ignore rules
├── package.json # Node.js dependencies
└── README.md # You're here
Clone the Repository
https://github.com/Alalade-Moses/HMS.git

 Install Dependencies
 npm install
 Create a .env File
 Inside .env, add:
 PORT=5000
MONGO_URI=your_mongodb_connection_string

 Start the Server:
 nodemon server.js
