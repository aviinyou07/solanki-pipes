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

// Define Certification Schema
const certificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    badgeText: { type: String, default: '' },
    noteText: { type: String, default: '' },
    link: { type: String, default: '' },
    iconType: { 
        type: String, 
        enum: ['shield-check', 'badge-check', 'clipboard-check', 'office-building', 'file-text'], 
        default: 'shield-check' 
    },
    createdDate: { type: Date, default: Date.now }
});

// Define Product Schema
const productSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom slug ID (e.g. 'hdpe', 'dwc-pipe', 'pvc-pipe')
    name: { type: String, required: true },
    slug: { type: String, required: true },
    shortDescription: { type: String, default: '' },
    mainImage: { type: String, default: '/images/product_01.png' },
    hoverImage: { type: String, default: '/images/product_01hover.png' },
    heroImage: { type: String, default: '/images/Hdpe_hero.png' },
    detailImage: { type: String, default: '/images/hdpepage.png' },
    bannerImage: { type: String, default: '/images/hdpe_02.svg' },
    galleryImages: [{ type: String }],
    link: { type: String, default: '' },
    badge: { type: String, default: '' },
    createdDate: { type: Date, default: Date.now }
});

// Define SiteSetting Schema for Site-wide Images and Media
const siteSettingSchema = new mongoose.Schema({
    _id: { type: String, default: 'default' },
    headerLogo: { type: String, default: '/images/blacklogo.png' },
    footerLogo: { type: String, default: '/images/SOLANKI-PIPES-LOGO-WHITE.png' },
    dhbvnEmpanelment: { type: String, default: '/images/dhbvn_empanelment.jpg' },
    qualityBanner: { type: String, default: '/images/sp_img1.jpeg' },
    cipetLogo: { type: String, default: '/images/cipet.png' },
    shriramlabLogo: { type: String, default: '/images/shriramlab.png' },
    collectionBanner: { type: String, default: '/images/collection.png' },
    catalogPdf: { type: String, default: '/images/Catalog Solanki Pipes.pdf' }
});

const Project = mongoose.model('Project', projectSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Certification = mongoose.model('Certification', certificationSchema);
const Product = mongoose.model('Product', productSchema);
const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema);

module.exports = {
    mongoose,
    Project,
    Admin,
    Certification,
    Product,
    SiteSetting
};


