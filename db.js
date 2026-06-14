require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

// Override DNS servers to resolve MongoDB Atlas SRV query issue (querySrv ECONNREFUSED)
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
    console.warn('Could not set custom DNS servers:', e);
}

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/solanki_pipes';

mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define Project Schema
const projectSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom slug ID (e.g. 'ludhiana-stp')
    title: { type: String, required: true },
    shortDescription: { type: String, default: '' },
    longDescription: { type: String, default: '' },
    image: { type: String, default: '/images/project_1.jpg' },
    category: { type: String, default: '' },
    location: { type: String, default: '' },
    department: { type: String, default: '' },
    segment: { type: String, default: '' },
    execution: { type: String, default: '' },
    specsDescription: { type: String, default: '' },
    specifications: [
        {
            size: { type: String, default: '' },
            rating: { type: String, default: '' }
        }
    ],
    specsFootnote: { type: String, default: '' },
    executionSteps: [{ type: String }],
    inspections: [
        {
            name: { type: String, default: '' },
            text: { type: String, default: '' },
            logo: { type: String, default: '/images/cipet.png' }
        }
    ],
    outcomeTitle: { type: String, default: '' },
    outcomeDescription: { type: String, default: '' },
    outcomeBtnText: { type: String, default: '' },
    outcomeBtnLink: { type: String, default: '' },
    createdDate: { type: Date, default: Date.now }
});

// Define Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

const Project = mongoose.model('Project', projectSchema);
const Admin = mongoose.model('Admin', adminSchema);

module.exports = {
    mongoose,
    Project,
    Admin
};
