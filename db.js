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

mongoose.set('bufferCommands', false);

mongoose.connection.on('error', (err) => {
    console.warn('MongoDB connection runtime warning:', err.message);
});

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

process.on('unhandledRejection', (reason, promise) => {
    console.warn('Unhandled Rejection intercepted:', reason && reason.message ? reason.message : reason);
});

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
    order: { type: Number, default: 0 },
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
    _id: { type: String, required: true }, // custom slug ID (e.g. 'hdpe', 'sprinkler')
    name: { type: String, required: true },
    slug: { type: String, required: true },
    tagline: { type: String, default: 'Better pipe, Better life' },
    headline: { type: String, default: '' },
    heroSubtitle: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    aboutTitle: { type: String, default: '' },
    aboutText: { type: String, default: '' },
    standards: { type: String, default: '' },
    sizeRange: { type: String, default: '' },
    pressureRating: { type: String, default: '' },
    materialGrade: { type: String, default: '' },
    mainImage: { type: String, default: '/images/product_01.png' },
    hoverImage: { type: String, default: '/images/product_01hover.png' },
    heroImage: { type: String, default: '/images/Hdpe_hero.png' },
    detailImage: { type: String, default: '/images/hdpepage.png' },
    bannerImage: { type: String, default: '/images/hdpe_02.svg' },
    galleryImages: [{ type: String }],
    videoUrl: { type: String, default: '' },
    videoFile: { type: String, default: '' },
    videoTitle: { type: String, default: '' },
    videoDescription: { type: String, default: '' },
    animationUrl: { type: String, default: '' },
    animationFile: { type: String, default: '' },
    animationTitle: { type: String, default: '' },
    animationSubtitle: { type: String, default: '' },
    features: [
        {
            icon: { type: String, default: '' },
            title: { type: String, default: '' },
            description: { type: String, default: '' }
        }
    ],
    applications: [{ type: String }],
    specifications: [
        {
            size: { type: String, default: '' },
            classType: { type: String, default: '' },
            wallThickness: { type: String, default: '' },
            workingPressure: { type: String, default: '' }
        }
    ],
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
    catalogPdf: { type: String, default: '/images/Catalog Solanki Pipes.pdf' },
    phone1: { type: String, default: '99921-77822' },
    phone2: { type: String, default: '94664-58070' },
    whatsapp: { type: String, default: '919992177822' },
    email: { type: String, default: 'sales@solankipipes.com' },
    headOffice: { type: String, default: 'Solanki Industries, Fatehabad Road, Mehuwala, Fatehabad, Haryana 125053' },
    manufacturingUnit: { type: String, default: 'Khasra No. 115//2/2, Sarsa Ghoghra, Bhiwani, Haryana 127021' },
    facebook: { type: String, default: 'https://facebook.com/solankipipes' },
    instagram: { type: String, default: 'https://instagram.com/solankipipes' },
    linkedin: { type: String, default: 'https://linkedin.com/company/solanki-pipes' }
});

// Define FounderMessage Schema for Founder's Message page content
const founderMessageSchema = new mongoose.Schema({
    _id: { type: String, default: 'default' },
    bannerTagline: { type: String, default: 'PIPES FOR A STRONGER TOMORROW' },
    founderName: { type: String, default: 'Sachin Solanki' },
    founderRole: { type: String, default: 'Head of Operations, Solanki Pipes' },
    founderQuote: { type: String, default: 'Quality today for a stronger tomorrow.' },
    founderImage: { type: String, default: '/images/founder_hritik_solanki.jpg' },
    categoryLabel: { type: String, default: 'FOUNDER’S MESSAGE' },
    headlinePart1: { type: String, default: 'Building a' },
    headlinePart2: { type: String, default: 'Stronger Tomorrow' },
    cursiveTagline: { type: String, default: 'More than Pipes, We Build Possibilities' },
    letterGreeting: { type: String, default: 'Dear Valued Customers, Partners and Well-wishers,' },
    letterParagraph1: { type: String, default: 'At Solanki Pipes, our journey has always been driven by a simple belief – that quality infrastructure builds a stronger, healthier and brighter tomorrow. Pipes may be unseen, but they play a vital role in every home, every industry and every community. That is why we are committed to delivering durable, reliable and high-performance piping solutions that stand the test of time.' },
    letterParagraph2: { type: String, default: 'Our focus has always been on innovation, uncompromising quality and customer satisfaction. With every product we manufacture, we aim to create value, build trust and contribute to a more sustainable future.' },
    letterParagraph3: { type: String, default: 'I would like to thank our customers, partners and dedicated team members for being an integral part of this journey. Together, we will continue to build stronger foundations for generations to come.' },
    signoffText: { type: String, default: 'Warm regards,' },
    signatureName: { type: String, default: 'Sachin Solanki' },
    signatureRole: { type: String, default: 'Head of Operations' },
    signatureCompany: { type: String, default: 'Solanki Industries (Solanki Pipes)' },
    pipeFittingsImage: { type: String, default: '/images/pipe_fittings_render.jpg' },
    galleryImage1: { type: String, default: '/images/sp_img1.jpeg' },
    galleryTitle1: { type: String, default: 'High-Speed HDPE Extrusion' },
    gallerySubtitle1: { type: String, default: 'Advanced Extrusion' },
    galleryImage2: { type: String, default: '/images/Quality.jpeg' },
    galleryTitle2: { type: String, default: 'In-House BIS Testing Lab' },
    gallerySubtitle2: { type: String, default: 'Quality Control' },
    galleryImage3: { type: String, default: '/images/sp_img2.jpeg' },
    galleryTitle3: { type: String, default: 'High-Capacity Inventory Yards' },
    gallerySubtitle3: { type: String, default: 'Storage & Dispatch' },
    galleryImage4: { type: String, default: '/images/197.jpg.jpeg' },
    galleryTitle4: { type: String, default: 'Agricultural Exhibition & CSR' },
    gallerySubtitle4: { type: String, default: 'Farmer Outreach' },
    leaders: { type: Array, default: [] },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false });

// Define PageContent Schema for customizable pages
const pageContentSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // e.g. 'home', 'about', 'contact', 'quality', 'downloads', 'farmers-fair', 'vendor-empanelment'
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now }
});

// Define Leader Schema
const leaderSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String, default: '' },
    roleLabel: { type: String, default: 'A MESSAGE FROM THE FOUNDER' },
    headline: { type: String, default: '' },
    headlineHighlight: { type: String, default: '' },
    greeting: { type: String, default: 'Dear Valued Customers, Partners and Well-wishers,' },
    paragraphs: [{ type: String }],
    quote: { type: String, default: '' },
    closing: { type: String, default: 'Warm regards,' },
    signature: { type: String, default: '' },
    signatureName: { type: String, default: '' },
    signatureType: { type: String, default: 'typed' },
    portraitImage: { type: String, default: '/images/sukinder_solanki.jpg' },
    supportingImage: { type: String, default: '/images/pipe_fittings_render.jpg' },
    companyName: { type: String, default: 'SOLANKI PIPES' },
    socialLinks: {
        linkedin: { type: String, default: '' },
        twitter: { type: String, default: '' },
        email: { type: String, default: '' }
    },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    updatedAt: { type: Date, default: Date.now }
});

// Define LeadershipActionCard Schema
const leadershipActionCardSchema = new mongoose.Schema({
    id: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '/images/sp_img1.jpeg' },
    displayOrder: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    updatedAt: { type: Date, default: Date.now }
});

// Define LeadershipPageSetting Schema
const leadershipPageSettingSchema = new mongoose.Schema({
    _id: { type: String, default: 'default' },
    pageTitle: { type: String, default: 'Leadership Messages' },
    breadcrumbHome: { type: String, default: 'Home' },
    breadcrumbAbout: { type: String, default: 'About Us' },
    breadcrumbCurrent: { type: String, default: 'Leadership Messages' },
    tagline: { type: String, default: 'PIPES FOR A STRONGER TOMORROW' },
    showTagline: { type: Boolean, default: true },
    actionSubtitle: { type: String, default: 'INFRASTRUCTURE & IMPACT' },
    actionTitle: { type: String, default: 'LEADERSHIP IN ACTION' },
    actionLocationBadge: { type: String, default: '• Fatehabad & Bhiwani Facilities' },
    carousel: {
        autoplay: { type: Boolean, default: true },
        autoplaySpeed: { type: Number, default: 6000 },
        pauseOnHover: { type: Boolean, default: true },
        showArrows: { type: Boolean, default: true },
        showDots: { type: Boolean, default: true },
        showLeaderTabs: { type: Boolean, default: true },
        transitionStyle: { type: String, default: 'slide' },
        transitionSpeed: { type: Number, default: 500 },
        enableSwipe: { type: Boolean, default: true },
        defaultActiveSlide: { type: Number, default: 0 }
    },
    updatedAt: { type: Date, default: Date.now }
});

// Define PopupSetting Schema for Home Page Promotional/Announcement Modal
const popupSettingSchema = new mongoose.Schema({
    _id: { type: String, default: 'default' },
    enabled: { type: Boolean, default: true },
    badgeText: { type: String, default: 'Special Announcement' },
    badgeColor: { type: String, default: 'rose' },
    title: { type: String, default: 'High-Performance HDPE Pipes' },
    titleHighlight: { type: String, default: 'at Factory Best Prices!' },
    description: { type: String, default: 'Supplying BIS-licensed PE80 & PE100 HDPE water and sewerage pipes up to 1000 mm diameter directly from our Fatehabad & Bhiwani manufacturing plants.' },
    image: { type: String, default: '/images/sp_img1.jpeg' },
    ctaText: { type: String, default: 'Explore Products' },
    ctaLink: { type: String, default: '/hdpe' },
    ctaTarget: { type: String, default: '_self' },
    ctaColor: { type: String, default: 'emerald' },
    displayFrequency: { type: String, default: 'every_refresh' },
    delaySeconds: { type: Number, default: 0.5 },
    updatedAt: { type: Date, default: Date.now }
});

const Project = mongoose.model('Project', projectSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Certification = mongoose.model('Certification', certificationSchema);
const Product = mongoose.model('Product', productSchema);
const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema);
const FounderMessage = mongoose.model('FounderMessage', founderMessageSchema);
const PageContent = mongoose.model('PageContent', pageContentSchema);
const Leader = mongoose.model('Leader', leaderSchema);
const LeadershipActionCard = mongoose.model('LeadershipActionCard', leadershipActionCardSchema);
const LeadershipPageSetting = mongoose.model('LeadershipPageSetting', leadershipPageSettingSchema);
const PopupSetting = mongoose.model('PopupSetting', popupSettingSchema);

module.exports = {
    mongoose,
    Project,
    Admin,
    Certification,
    Product,
    SiteSetting,
    FounderMessage,
    PageContent,
    Leader,
    LeadershipActionCard,
    LeadershipPageSetting,
    PopupSetting
};


