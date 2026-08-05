const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { Project, Admin, Certification, Product, SiteSetting } = require('./db');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// Auto-seed certifications if database is empty on start
Certification.countDocuments().then(count => {
    if (count === 0) {
        const certsFilePath = path.join(__dirname, 'data', 'certifications.json');
        if (fs.existsSync(certsFilePath)) {
            const rawCerts = fs.readFileSync(certsFilePath, 'utf8');
            const certsData = JSON.parse(rawCerts);
            Certification.insertMany(certsData)
                .then(() => console.log('Successfully auto-seeded initial certifications'))
                .catch(err => console.error('Failed to auto-seed certifications:', err));
        }
    }
}).catch(err => console.error('Error checking certification count:', err));

// Auto-seed products if database is empty on start
Product.countDocuments().then(count => {
    if (count === 0) {
        const productsFilePath = path.join(__dirname, 'data', 'products.json');
        if (fs.existsSync(productsFilePath)) {
            const rawProducts = fs.readFileSync(productsFilePath, 'utf8');
            const productsData = JSON.parse(rawProducts);
            const formattedProducts = productsData.map(p => {
                const formatted = { ...p, _id: p.id };
                delete formatted.id;
                return formatted;
            });
            Product.insertMany(formattedProducts)
                .then(() => console.log('Successfully auto-seeded initial products'))
                .catch(err => console.error('Failed to auto-seed products:', err));
        }
    }
}).catch(err => console.error('Error checking product count:', err));

// Helper: Get or initialize SiteSetting document
async function getSiteSettings() {
    try {
        let settings = await SiteSetting.findById('default');
        if (!settings) {
            settings = await SiteSetting.create({ _id: 'default' });
        }
        return settings;
    } catch (err) {
        console.error('Error fetching SiteSettings:', err);
        return {
            headerLogo: '/images/blacklogo.png',
            footerLogo: '/images/SOLANKI-PIPES-LOGO-WHITE.png',
            dhbvnEmpanelment: '/images/dhbvn_empanelment.jpg',
            qualityBanner: '/images/sp_img1.jpeg',
            cipetLogo: '/images/cipet.png',
            shriramlabLogo: '/images/shriramlab.png',
            collectionBanner: '/images/collection.png',
            catalogPdf: '/images/Catalog Solanki Pipes.pdf'
        };
    }
}

// Configure multer storage for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'public', 'images', 'uploads');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const uploadProductImages = upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'hoverImage', maxCount: 1 },
    { name: 'heroImage', maxCount: 1 },
    { name: 'detailImage', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 },
    { name: 'gallery1', maxCount: 1 },
    { name: 'gallery2', maxCount: 1 },
    { name: 'gallery3', maxCount: 1 }
]);

const uploadSiteMedia = upload.fields([
    { name: 'headerLogo', maxCount: 1 },
    { name: 'footerLogo', maxCount: 1 },
    { name: 'dhbvnEmpanelment', maxCount: 1 },
    { name: 'qualityBanner', maxCount: 1 },
    { name: 'cipetLogo', maxCount: 1 },
    { name: 'shriramlabLogo', maxCount: 1 },
    { name: 'collectionBanner', maxCount: 1 },
    { name: 'catalogPdf', maxCount: 1 }
]);

// MongoDB models are imported from ./db

// Helper: parse project document from MongoDB
function parseProject(doc) {
    if (!doc) return null;
    const project = doc.toObject ? doc.toObject() : doc;
    let formattedDate = '';
    if (project.createdDate) {
        const d = new Date(project.createdDate);
        if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
        }
    }
    return {
        ...project,
        id: project._id,
        createdDate: formattedDate
    };
}

// Helper: parse form body into array fields
function parseFormArrays(body) {
    let specifications = [];
    if (body.specSizes && body.specRatings) {
        const sizes = Array.isArray(body.specSizes) ? body.specSizes : [body.specSizes];
        const ratings = Array.isArray(body.specRatings) ? body.specRatings : [body.specRatings];
        for (let i = 0; i < sizes.length; i++) {
            if (sizes[i]) specifications.push({ size: sizes[i], rating: ratings[i] || '' });
        }
    }

    let executionSteps = [];
    if (body.executionSteps) {
        executionSteps = Array.isArray(body.executionSteps) ? body.executionSteps.filter(Boolean) : [body.executionSteps].filter(Boolean);
    }

    let inspections = [];
    if (body.inspectionNames && body.inspectionTexts) {
        const names = Array.isArray(body.inspectionNames) ? body.inspectionNames : [body.inspectionNames];
        const texts = Array.isArray(body.inspectionTexts) ? body.inspectionTexts : [body.inspectionTexts];
        const logos = Array.isArray(body.inspectionLogos) ? body.inspectionLogos : [body.inspectionLogos];
        for (let i = 0; i < names.length; i++) {
            if (names[i]) {
                inspections.push({ name: names[i], text: texts[i] || '', logo: logos[i] || '/images/cipet.png' });
            }
        }
    }

    return { specifications, executionSteps, inspections };
}

// Parse JSON and URL-encoded bodies for form submissions
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: 'solanki-pipes-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Set EJS as the template engine
app.set('view engine', 'ejs');

// Serve static files (images, custom css) from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // Also serve from root for image folder
app.set('views', path.join(__dirname, 'views'));

// Global middleware to pass siteSettings to all views
app.use(async (req, res, next) => {
    res.locals.siteSettings = await getSiteSettings();
    next();
});

// Route for the home page
app.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana', products });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana', products: [] });
    }
});
// Route for the about page
app.get('/about', (req, res) => {
    res.render('about', { title: 'About Solanki Industries' });
});

// Route for HDPE page
app.get('/hdpe', async (req, res) => {
    try {
        const product = await Product.findById('hdpe');
        const products = await Product.find();
        res.render('hdpe', { title: 'HDPE Pipes (IS 4984) — Solanki Pipes', product, products });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('hdpe', { title: 'HDPE Pipes (IS 4984) — Solanki Pipes', product: null, products: [] });
    }
});

app.get('/hdpe-water', async (req, res) => {
    try {
        const product = await Product.findById('hdpe');
        const products = await Product.find();
        res.render('hdpe', { title: 'HDPE Water Pipe — Solanki Pipes', product, products });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('hdpe', { title: 'HDPE Water Pipe — Solanki Pipes', product: null, products: [] });
    }
});

app.get('/hdpe-sewerage', async (req, res) => {
    try {
        const product = await Product.findById('hdpe');
        const products = await Product.find();
        res.render('hdpe', { title: 'HDPE Sewerage Pipe — Solanki Pipes', product, products });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('hdpe', { title: 'HDPE Sewerage Pipe — Solanki Pipes', product: null, products: [] });
    }
});

app.get('/dwc-pipe', async (req, res) => {
    try {
        const product = await Product.findById('dwc-pipe');
        const products = await Product.find();
        res.render('dwc-pipe', { title: 'DWC Pipe — Solanki Pipes', product, products });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('dwc-pipe', { title: 'DWC Pipe — Solanki Pipes', product: null, products: [] });
    }
});

app.get('/pvc-pipe', async (req, res) => {
    try {
        const product = await Product.findById('pvc-pipe');
        const products = await Product.find();
        res.render('pvc-pipe', { title: 'PVC Pipe — Solanki Pipes', product, products });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('pvc-pipe', { title: 'PVC Pipe — Solanki Pipes', product: null, products: [] });
    }
});

// Route for the quality page
app.get('/quality', async (req, res) => {
    try {
        const certifications = await Certification.find().sort({ createdDate: 1 });
        res.render('quality', { title: 'Quality Assurance — Solanki Industries', certifications });
    } catch (err) {
        console.error('Error fetching certifications:', err);
        res.render('quality', { title: 'Quality Assurance — Solanki Industries', certifications: [] });
    }
});

// ==========================================
// PUBLIC PROJECT ROUTES
// ==========================================

// Route for the projects listing page
app.get('/projects', async (req, res) => {
    try {
        const docs = await Project.find().sort({ createdDate: -1 });
        const projects = docs.map(parseProject);
        res.render('projects', { title: 'Projects & Case Studies — Solanki Industries', projects });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('projects', { title: 'Projects & Case Studies — Solanki Industries', projects: [] });
    }
});

// Route for project detail view
app.get('/projects/:id', async (req, res) => {
    try {
        const doc = await Project.findById(req.params.id);
        if (!doc) return res.status(404).send('Project not found');
        const project = parseProject(doc);
        res.render('project-detail', { title: `${project.title} — Solanki Pipes`, project });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// ==========================================
// ADMIN AUTH ROUTES
// ==========================================

// Admin: Redirect /admin to /admin/login
app.get('/admin', (req, res) => {
    res.redirect('/admin/login');
});

// Admin: Login page
app.get('/admin/login', (req, res) => {
    if (req.session && req.session.admin) {
        return res.redirect('/admin/projects');
    }
    res.render('admin-login', { title: 'Admin Login — Solanki Industries', error: null });
});

// Admin: Handle login POST
app.post('/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const admin = await Admin.findOne({ username });
        if (!admin) {
            return res.render('admin-login', { title: 'Admin Login — Solanki Industries', error: 'Invalid username or password' });
        }
        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.render('admin-login', { title: 'Admin Login — Solanki Industries', error: 'Invalid username or password' });
        }
        req.session.admin = { id: admin._id, username: admin.username };
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('Login Error:', err);
        res.render('admin-login', { title: 'Admin Login — Solanki Industries', error: 'Something went wrong. Please try again.' });
    }
});

// Admin: Logout
app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
});

// Auth middleware — protect all /admin/* routes below
function requireAdmin(req, res, next) {
    if (req.session && req.session.admin) {
        return next();
    }
    res.redirect('/admin/login');
}
app.use('/admin', requireAdmin);

// ==========================================
// ADMIN PROJECT ROUTES
// ==========================================

// Admin: List all projects
app.get('/admin/projects', async (req, res) => {
    try {
        const docs = await Project.find().sort({ createdDate: -1 });
        const projects = docs.map(parseProject);
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects, activeTab: 'projects' });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects: [], activeTab: 'projects' });
    }
});

// Admin: Show add project page
app.get('/admin/projects/add', (req, res) => {
    res.render('admin-project-form', { title: 'Add New Project', project: null, action: '/admin/projects/add' });
});

// Admin: Show edit project page
app.get('/admin/projects/edit/:id', async (req, res) => {
    try {
        const doc = await Project.findById(req.params.id);
        if (!doc) return res.status(404).send('Project not found');
        const project = parseProject(doc);
        res.render('admin-project-form', { title: 'Edit Project', project, action: `/admin/projects/edit/${project.id}` });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Show view project page (read-only detail from admin)
app.get('/admin/projects/view/:id', async (req, res) => {
    try {
        const doc = await Project.findById(req.params.id);
        if (!doc) return res.status(404).send('Project not found');
        const project = parseProject(doc);
        res.render('project-detail', { title: `${project.title} — Solanki Pipes`, project });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle add project POST
app.post('/admin/projects/add', upload.single('image'), async (req, res) => {
    try {
        const { title, shortDescription, longDescription, category, location, department, segment, execution, specsDescription, specsFootnote, outcomeTitle, outcomeDescription, outcomeBtnText, outcomeBtnLink } = req.body;
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const image = req.file ? `/images/uploads/${req.file.filename}` : '/images/project_1.jpg';
        const { specifications, executionSteps, inspections } = parseFormArrays(req.body);

        await Project.create({
            _id: id,
            title,
            shortDescription,
            longDescription,
            image,
            category,
            location,
            department,
            segment,
            execution,
            specsDescription,
            specifications,
            specsFootnote,
            executionSteps,
            inspections,
            outcomeTitle,
            outcomeDescription,
            outcomeBtnText,
            outcomeBtnLink,
            createdDate: new Date()
        });
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to add project: ' + err.message);
    }
});

// Admin: Handle edit project POST
app.post('/admin/projects/edit/:id', upload.single('image'), async (req, res) => {
    try {
        const { title, shortDescription, longDescription, category, location, department, segment, execution, specsDescription, specsFootnote, outcomeTitle, outcomeDescription, outcomeBtnText, outcomeBtnLink } = req.body;
        const { specifications, executionSteps, inspections } = parseFormArrays(req.body);

        // Get current image if no new one uploaded
        let image;
        if (req.file) {
            image = `/images/uploads/${req.file.filename}`;
        } else {
            const doc = await Project.findById(req.params.id);
            image = doc ? doc.image : '/images/project_1.jpg';
        }

        await Project.findByIdAndUpdate(req.params.id, {
            title,
            shortDescription,
            longDescription,
            image,
            category,
            location,
            department,
            segment,
            execution,
            specsDescription,
            specifications,
            specsFootnote,
            executionSteps,
            inspections,
            outcomeTitle,
            outcomeDescription,
            outcomeBtnText,
            outcomeBtnLink
        });
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to update project: ' + err.message);
    }
});

// Admin: Handle delete project POST
app.post('/admin/projects/delete/:id', async (req, res) => {
    try {
        await Project.findByIdAndDelete(req.params.id);
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to delete project');
    }
});

// ==========================================
// ADMIN CERTIFICATION ROUTES
// ==========================================

// Admin: List all certifications
app.get('/admin/certifications', async (req, res) => {
    try {
        const certifications = await Certification.find().sort({ createdDate: 1 });
        res.render('admin-certifications', { title: 'Admin — Manage Certifications', certifications, activeTab: 'certifications' });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('admin-certifications', { title: 'Admin — Manage Certifications', certifications: [], activeTab: 'certifications' });
    }
});

// Admin: Show add certification page
app.get('/admin/certifications/add', (req, res) => {
    res.render('admin-certification-form', { title: 'Add New Certification', certification: null, action: '/admin/certifications/add', activeTab: 'certifications' });
});

// Admin: Show edit certification page
app.get('/admin/certifications/edit/:id', async (req, res) => {
    try {
        const certification = await Certification.findById(req.params.id);
        if (!certification) return res.status(404).send('Certification not found');
        res.render('admin-certification-form', { title: 'Edit Certification', certification, action: `/admin/certifications/edit/${certification._id}`, activeTab: 'certifications' });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle add certification POST
app.post('/admin/certifications/add', upload.single('file'), async (req, res) => {
    try {
        const { title, subtitle, badgeText, noteText, iconType, externalLink } = req.body;
        let link = externalLink || '';
        if (req.file) {
            link = `/images/uploads/${req.file.filename}`;
        }
        await Certification.create({
            title,
            subtitle,
            badgeText,
            noteText,
            iconType,
            link
        });
        res.redirect('/admin/certifications');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to add certification: ' + err.message);
    }
});

// Admin: Handle edit certification POST
app.post('/admin/certifications/edit/:id', upload.single('file'), async (req, res) => {
    try {
        const { title, subtitle, badgeText, noteText, iconType, externalLink } = req.body;
        
        let link;
        if (req.file) {
            link = `/images/uploads/${req.file.filename}`;
        } else {
            const doc = await Certification.findById(req.params.id);
            link = doc ? doc.link : '';
            if (externalLink !== undefined) {
                link = externalLink;
            }
        }

        await Certification.findByIdAndUpdate(req.params.id, {
            title,
            subtitle,
            badgeText,
            noteText,
            iconType,
            link
        });
        res.redirect('/admin/certifications');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to update certification: ' + err.message);
    }
});

// Admin: Handle delete certification POST
app.post('/admin/certifications/delete/:id', async (req, res) => {
    try {
        await Certification.findByIdAndDelete(req.params.id);
        res.redirect('/admin/certifications');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to delete certification');
    }
});

// ==========================================
// ADMIN PRODUCT ROUTES
// ==========================================

// Admin: List all products
app.get('/admin/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdDate: 1 });
        res.render('admin-products', { title: 'Admin — Manage Products', products, activeTab: 'products' });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('admin-products', { title: 'Admin — Manage Products', products: [], activeTab: 'products' });
    }
});

// Admin: Show add product page
app.get('/admin/products/add', (req, res) => {
    res.render('admin-product-form', { title: 'Add New Product', product: null, action: '/admin/products/add', activeTab: 'products' });
});

// Admin: Show edit product page
app.get('/admin/products/edit/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        res.render('admin-product-form', { title: 'Edit Product', product, action: `/admin/products/edit/${product._id}`, activeTab: 'products' });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle add product POST
app.post('/admin/products/add', uploadProductImages, async (req, res) => {
    try {
        const { name, slug, shortDescription, link, badge } = req.body;
        const id = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const mainImage = req.files && req.files['mainImage'] ? `/images/uploads/${req.files['mainImage'][0].filename}` : '/images/product_01.png';
        const hoverImage = req.files && req.files['hoverImage'] ? `/images/uploads/${req.files['hoverImage'][0].filename}` : mainImage;
        const heroImage = req.files && req.files['heroImage'] ? `/images/uploads/${req.files['heroImage'][0].filename}` : '/images/Hdpe_hero.png';
        const detailImage = req.files && req.files['detailImage'] ? `/images/uploads/${req.files['detailImage'][0].filename}` : '/images/hdpepage.png';
        const bannerImage = req.files && req.files['bannerImage'] ? `/images/uploads/${req.files['bannerImage'][0].filename}` : '/images/hdpe_02.svg';

        const galleryImages = [
            req.files && req.files['gallery1'] ? `/images/uploads/${req.files['gallery1'][0].filename}` : '/images/hdpe-gallery-1.jpeg',
            req.files && req.files['gallery2'] ? `/images/uploads/${req.files['gallery2'][0].filename}` : '/images/hdpe-gallery-2.jpeg',
            req.files && req.files['gallery3'] ? `/images/uploads/${req.files['gallery3'][0].filename}` : '/images/hdpe-gallery-3.jpeg'
        ];

        await Product.create({
            _id: id,
            name,
            slug: id,
            shortDescription,
            mainImage,
            hoverImage,
            heroImage,
            detailImage,
            bannerImage,
            galleryImages,
            link: link || `/${id}`,
            badge
        });
        res.redirect('/admin/products');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to add product: ' + err.message);
    }
});

// Admin: Handle edit product POST
app.post('/admin/products/edit/:id', uploadProductImages, async (req, res) => {
    try {
        const { name, slug, shortDescription, link, badge } = req.body;
        const doc = await Product.findById(req.params.id);
        if (!doc) return res.status(404).send('Product not found');

        let mainImage = doc.mainImage;
        let hoverImage = doc.hoverImage;
        let heroImage = doc.heroImage;
        let detailImage = doc.detailImage;
        let bannerImage = doc.bannerImage || '/images/hdpe_02.svg';
        let galleryImages = doc.galleryImages && doc.galleryImages.length === 3 ? [...doc.galleryImages] : ['/images/hdpe-gallery-1.jpeg', '/images/hdpe-gallery-2.jpeg', '/images/hdpe-gallery-3.jpeg'];

        if (req.files) {
            if (req.files['mainImage']) mainImage = `/images/uploads/${req.files['mainImage'][0].filename}`;
            if (req.files['hoverImage']) hoverImage = `/images/uploads/${req.files['hoverImage'][0].filename}`;
            if (req.files['heroImage']) heroImage = `/images/uploads/${req.files['heroImage'][0].filename}`;
            if (req.files['detailImage']) detailImage = `/images/uploads/${req.files['detailImage'][0].filename}`;
            if (req.files['bannerImage']) bannerImage = `/images/uploads/${req.files['bannerImage'][0].filename}`;
            if (req.files['gallery1']) galleryImages[0] = `/images/uploads/${req.files['gallery1'][0].filename}`;
            if (req.files['gallery2']) galleryImages[1] = `/images/uploads/${req.files['gallery2'][0].filename}`;
            if (req.files['gallery3']) galleryImages[2] = `/images/uploads/${req.files['gallery3'][0].filename}`;
        }

        await Product.findByIdAndUpdate(req.params.id, {
            name,
            slug: slug || doc.slug,
            shortDescription,
            mainImage,
            hoverImage,
            heroImage,
            detailImage,
            bannerImage,
            galleryImages,
            link: link || `/${req.params.id}`,
            badge
        });
        res.redirect('/admin/products');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to update product: ' + err.message);
    }
});

// Admin: Handle delete product POST
app.post('/admin/products/delete/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.redirect('/admin/products');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to delete product');
    }
});

// ==========================================
// ADMIN SITE SETTINGS & MEDIA ROUTES
// ==========================================

// Admin: Show site media settings page
app.get('/admin/settings', async (req, res) => {
    try {
        const settings = await getSiteSettings();
        res.render('admin-settings', { title: 'Admin — Manage Site Media & Logos', settings, activeTab: 'settings' });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle site media settings POST
app.post('/admin/settings', uploadSiteMedia, async (req, res) => {
    try {
        let settings = await SiteSetting.findById('default');
        if (!settings) {
            settings = new SiteSetting({ _id: 'default' });
        }

        if (req.files) {
            if (req.files['headerLogo']) settings.headerLogo = `/images/uploads/${req.files['headerLogo'][0].filename}`;
            if (req.files['footerLogo']) settings.footerLogo = `/images/uploads/${req.files['footerLogo'][0].filename}`;
            if (req.files['dhbvnEmpanelment']) settings.dhbvnEmpanelment = `/images/uploads/${req.files['dhbvnEmpanelment'][0].filename}`;
            if (req.files['qualityBanner']) settings.qualityBanner = `/images/uploads/${req.files['qualityBanner'][0].filename}`;
            if (req.files['cipetLogo']) settings.cipetLogo = `/images/uploads/${req.files['cipetLogo'][0].filename}`;
            if (req.files['shriramlabLogo']) settings.shriramlabLogo = `/images/uploads/${req.files['shriramlabLogo'][0].filename}`;
            if (req.files['collectionBanner']) settings.collectionBanner = `/images/uploads/${req.files['collectionBanner'][0].filename}`;
            if (req.files['catalogPdf']) settings.catalogPdf = `/images/uploads/${req.files['catalogPdf'][0].filename}`;
        }

        await settings.save();
        res.redirect('/admin/settings');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to update settings: ' + err.message);
    }
});

// Route for the Farmers' Fair CSR Event page
app.get('/farmers-fair', (req, res) => {
    res.render('farmers-fair', { title: 'Farmers’ Fair & Agricultural Exhibition Sponsorship — Solanki Pipes' });
});

// Route for the contact page
app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact Solanki Industries' });
});

// app.get('/downloads', (req, res) => {
//     res.render('downloads', { title: 'Downloads — Solanki Industries' });
// });

app.get('/vendor-empanelment', (req, res) => {
    res.render('vendor-empanelment', { title: 'Vendor Empanelment — Solanki Industries' });
});

app.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Privacy Policy — Solanki Industries' });
});

app.get('/terms', (req, res) => {
    res.render('terms', { title: 'Terms & Conditions — Solanki Industries' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});