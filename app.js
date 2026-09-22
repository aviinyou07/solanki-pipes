const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { mongoose, Project, Admin, Certification, Product, SiteSetting, FounderMessage } = require('./db');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// Auto-seed data when database connects
mongoose.connection.once('open', async () => {
    try {
        const certCount = await Certification.countDocuments();
        if (certCount === 0) {
            const certsFilePath = path.join(__dirname, 'data', 'certifications.json');
            if (fs.existsSync(certsFilePath)) {
                const rawCerts = fs.readFileSync(certsFilePath, 'utf8');
                const certsData = JSON.parse(rawCerts);
                await Certification.insertMany(certsData);
                console.log('Successfully auto-seeded initial certifications');
            }
        }
    } catch (err) {
        console.error('Certification seed error:', err.message);
    }

    try {
        const productsFilePath = path.join(__dirname, 'data', 'products.json');
        if (fs.existsSync(productsFilePath)) {
            const rawProducts = fs.readFileSync(productsFilePath, 'utf8');
            const productsData = JSON.parse(rawProducts);
            
            // Clean up obsolete products (dwc-pipe, pvc-pipe)
            await Product.deleteMany({ _id: { $in: ['dwc-pipe', 'pvc-pipe'] } });

            for (const p of productsData) {
                const id = p.id || p._id;
                const doc = { ...p, _id: id };
                delete doc.id;
                await Product.findByIdAndUpdate(id, doc, { upsert: true, new: true, setDefaultsOnInsert: true });
            }
            console.log('Successfully synced and seeded products (HDPE and Sprinkler)');
        }
    } catch (err) {
        console.error('Product seed error:', err.message);
    }

    try {
        const projectCount = await Project.countDocuments();
        if (projectCount === 0) {
            const projectsFilePath = path.join(__dirname, 'data', 'projects.json');
            if (fs.existsSync(projectsFilePath)) {
                const rawProjects = fs.readFileSync(projectsFilePath, 'utf8');
                const projectsData = JSON.parse(rawProjects);
                const projectsToInsert = projectsData.map((p, idx) => ({
                    ...p,
                    _id: p.id || p._id,
                    order: idx
                }));
                await Project.insertMany(projectsToInsert);
                console.log('Successfully auto-seeded initial projects with sequence');
            }
        } else {
            // Ensure all existing projects have order field assigned
            const existingProjects = await Project.find().sort({ order: 1, createdDate: -1 });
            for (let i = 0; i < existingProjects.length; i++) {
                if (typeof existingProjects[i].order !== 'number') {
                    await Project.findByIdAndUpdate(existingProjects[i]._id, { order: i });
                }
            }
        }
    } catch (err) {
        console.error('Project sequence initialization error:', err.message);
    }
});

// Fallback settings object
const defaultSiteSettings = {
    headerLogo: '/images/blacklogo.png',
    footerLogo: '/images/SOLANKI-PIPES-LOGO-WHITE.png',
    dhbvnEmpanelment: '/images/dhbvn_empanelment.jpg',
    qualityBanner: '/images/sp_img1.jpeg',
    cipetLogo: '/images/cipet.png',
    shriramlabLogo: '/images/shriramlab.png',
    collectionBanner: '/images/collection.png',
    catalogPdf: '/images/Catalog Solanki Pipes.pdf'
};

// Fallback Founder Message object
const defaultFounderMessage = {
    bannerTagline: 'PIPES FOR A STRONGER TOMORROW',
    founderName: 'Sachin Solanki',
    founderRole: 'Founder, Solanki Pipes',
    founderQuote: 'Quality today for a stronger tomorrow.',
    founderImage: '/images/founder_hritik_solanki.jpg',
    categoryLabel: 'FOUNDER’S MESSAGE',
    headlinePart1: 'Building a',
    headlinePart2: 'Stronger Tomorrow',
    cursiveTagline: 'More than Pipes, We Build Possibilities',
    letterGreeting: 'Dear Valued Customers, Partners and Well-wishers,',
    letterParagraph1: 'At Solanki Pipes, our journey has always been driven by a simple belief – that quality infrastructure builds a stronger, healthier and brighter tomorrow. Pipes may be unseen, but they play a vital role in every home, every industry and every community. That is why we are committed to delivering durable, reliable and high-performance piping solutions that stand the test of time.',
    letterParagraph2: 'Our focus has always been on innovation, uncompromising quality and customer satisfaction. With every product we manufacture, we aim to create value, build trust and contribute to a more sustainable future.',
    letterParagraph3: 'I would like to thank our customers, partners and dedicated team members for being an integral part of this journey. Together, we will continue to build stronger foundations for generations to come.',
    signoffText: 'Warm regards,',
    signatureName: 'Sachin Solanki',
    signatureRole: 'Founder',
    signatureCompany: 'Solanki Pipes',
    pipeFittingsImage: '/images/pipe_fittings_render.jpg',
    galleryImage1: '/images/sp_img1.jpeg',
    galleryTitle1: 'High-Speed HDPE Extrusion',
    gallerySubtitle1: 'Advanced Extrusion',
    galleryImage2: '/images/Quality.jpeg',
    galleryTitle2: 'In-House BIS Testing Lab',
    gallerySubtitle2: 'Quality Control',
    galleryImage3: '/images/sp_img2.jpeg',
    galleryTitle3: 'High-Capacity Inventory Yards',
    gallerySubtitle3: 'Storage & Dispatch',
    galleryImage4: '/images/197.jpg.jpeg',
    galleryTitle4: 'Agricultural Exhibition & CSR',
    gallerySubtitle4: 'Farmer Outreach'
};

// Helper: Get or initialize SiteSetting document
async function getSiteSettings() {
    if (mongoose.connection.readyState !== 1) {
        return defaultSiteSettings;
    }
    try {
        let settings = await SiteSetting.findById('default').maxTimeMS(2000);
        if (!settings) {
            settings = await SiteSetting.create({ _id: 'default' });
        }
        return settings;
    } catch (err) {
        console.error('Error fetching SiteSettings:', err);
        return defaultSiteSettings;
    }
}

// Helper: Get or initialize FounderMessage document
async function getFounderMessage() {
    if (mongoose.connection.readyState !== 1) {
        return defaultFounderMessage;
    }
    try {
        let doc = await FounderMessage.findById('default').maxTimeMS(2000);
        if (!doc) {
            doc = await FounderMessage.create({ _id: 'default', ...defaultFounderMessage });
        }
        return doc;
    } catch (err) {
        console.error('Error fetching FounderMessage:', err);
        return defaultFounderMessage;
    }
}

// Helper: Get fallback products from JSON
function getDefaultProducts() {
    try {
        const productsFilePath = path.join(__dirname, 'data', 'products.json');
        if (fs.existsSync(productsFilePath)) {
            const rawProducts = fs.readFileSync(productsFilePath, 'utf8');
            const data = JSON.parse(rawProducts);
            return data.map(p => ({ ...p, _id: p.id || p._id }));
        }
    } catch (e) {
        console.error('Error reading default products.json:', e);
    }
    return [];
}

async function getProductsData() {
    if (mongoose.connection.readyState !== 1) {
        return getDefaultProducts();
    }
    try {
        const docs = await Product.find().maxTimeMS(2500);
        if (docs && docs.length > 0) return docs;
        return getDefaultProducts();
    } catch (err) {
        console.error('Error fetching Products from DB:', err.message);
        return getDefaultProducts();
    }
}

async function getProductById(id) {
    if (mongoose.connection.readyState !== 1) {
        const defaults = getDefaultProducts();
        return defaults.find(p => p._id === id || p.slug === id) || null;
    }
    try {
        const doc = await Product.findById(id).maxTimeMS(2500);
        if (doc) return doc;
        const defaults = getDefaultProducts();
        return defaults.find(p => p._id === id || p.slug === id) || null;
    } catch (err) {
        console.error(`Error fetching Product ${id} from DB:`, err.message);
        const defaults = getDefaultProducts();
        return defaults.find(p => p._id === id || p.slug === id) || null;
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
    { name: 'gallery3', maxCount: 1 },
    { name: 'videoFile', maxCount: 1 },
    { name: 'animationFile', maxCount: 1 }
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

const uploadFounderMedia = upload.fields([
    { name: 'founderImage', maxCount: 1 },
    { name: 'pipeFittingsImage', maxCount: 1 },
    { name: 'galleryImage1', maxCount: 1 },
    { name: 'galleryImage2', maxCount: 1 },
    { name: 'galleryImage3', maxCount: 1 },
    { name: 'galleryImage4', maxCount: 1 }
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
        order: (typeof project.order === 'number') ? project.order : 0,
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

// Helper: parse product form arrays (features, specs, applications)
function parseProductFormArrays(body) {
    let features = [];
    if (body.featureTitles) {
        const titles = Array.isArray(body.featureTitles) ? body.featureTitles : [body.featureTitles];
        const descriptions = Array.isArray(body.featureDescriptions) ? body.featureDescriptions : [body.featureDescriptions];
        const icons = Array.isArray(body.featureIcons) ? body.featureIcons : [body.featureIcons];
        for (let i = 0; i < titles.length; i++) {
            if (titles[i] && titles[i].trim()) {
                features.push({
                    title: titles[i].trim(),
                    description: (descriptions[i] || '').trim(),
                    icon: (icons[i] || '').trim() || 'https://cdn-icons-png.flaticon.com/512/1705/1705833.png'
                });
            }
        }
    }

    let specifications = [];
    if (body.specSizes) {
        const sizes = Array.isArray(body.specSizes) ? body.specSizes : [body.specSizes];
        const classTypes = Array.isArray(body.specClasses) ? body.specClasses : [body.specClasses];
        const wallThicknesses = Array.isArray(body.specThicknesses) ? body.specThicknesses : [body.specThicknesses];
        const workingPressures = Array.isArray(body.specPressures) ? body.specPressures : [body.specPressures];
        for (let i = 0; i < sizes.length; i++) {
            if (sizes[i] && sizes[i].trim()) {
                specifications.push({
                    size: sizes[i].trim(),
                    classType: (classTypes[i] || '').trim(),
                    wallThickness: (wallThicknesses[i] || '').trim(),
                    workingPressure: (workingPressures[i] || '').trim()
                });
            }
        }
    }

    let applications = [];
    if (body.applications) {
        if (Array.isArray(body.applications)) {
            applications = body.applications.map(a => a.trim()).filter(Boolean);
        } else if (typeof body.applications === 'string') {
            applications = body.applications.split('\n').map(a => a.trim()).filter(Boolean);
        }
    }

    return { features, specifications, applications };
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
        const products = await getProductsData();
        res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana', products });
    } catch (err) {
        console.error('Home Page Error:', err);
        res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana', products: getDefaultProducts() });
    }
});
// Route for the about page
app.get('/about', (req, res) => {
    res.render('about', { title: 'About Solanki Industries' });
});

// Route for founder message page
app.get('/founder-message', async (req, res) => {
    try {
        const founderData = await getFounderMessage();
        res.render('founder-message', { title: "Founder's Message — Solanki Industries", founderData: founderData || defaultFounderMessage });
    } catch (err) {
        console.error('Error loading founder message:', err);
        res.render('founder-message', { title: "Founder's Message — Solanki Industries", founderData: defaultFounderMessage });
    }
});

app.get('/founder', (req, res) => {
    res.redirect('/founder-message');
});

// Route for HDPE page
app.get('/hdpe', async (req, res) => {
    try {
        const product = await getProductById('hdpe');
        const products = await getProductsData();
        res.render('hdpe', { title: 'HDPE Pipes (IS 4984) — Solanki Pipes', product, products });
    } catch (err) {
        console.error('HDPE Page Error:', err);
        const defaults = getDefaultProducts();
        res.render('hdpe', { title: 'HDPE Pipes (IS 4984) — Solanki Pipes', product: defaults.find(p => p._id === 'hdpe') || null, products: defaults });
    }
});

app.get('/hdpe-water', (req, res) => {
    res.redirect('/hdpe');
});

app.get('/hdpe-sewerage', (req, res) => {
    res.redirect('/hdpe');
});

// Route for Sprinkler page
app.get(['/sprinkler', '/sprinkler-pipe'], async (req, res) => {
    try {
        const product = await getProductById('sprinkler');
        const products = await getProductsData();
        res.render('sprinkler', { title: 'HDPE Sprinkler Pipes (IS 14151) — Solanki Pipes', product, products });
    } catch (err) {
        console.error('Sprinkler Page Error:', err);
        const defaults = getDefaultProducts();
        res.render('sprinkler', { title: 'HDPE Sprinkler Pipes (IS 14151) — Solanki Pipes', product: defaults.find(p => p._id === 'sprinkler') || null, products: defaults });
    }
});

// Legacy redirects
app.get('/dwc-pipe', (req, res) => {
    res.redirect('/sprinkler');
});

app.get('/pvc-pipe', (req, res) => {
    res.redirect('/hdpe');
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
        const docs = await Project.find().sort({ order: 1, createdDate: -1 });
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

        // Default admin credentials check
        if ((username === 'admin' && password === 'admin@123') || 
            (username === 'sachin' && password === 'sachin@123') || 
            (username === 'hritik' && password === 'hritik@123')) {
            req.session.admin = { id: 'admin-default', username: username };
            return res.redirect('/admin/founder-message');
        }

        if (mongoose.connection.readyState === 1) {
            const admin = await Admin.findOne({ username }).maxTimeMS(2000);
            if (admin) {
                const match = await bcrypt.compare(password, admin.password);
                if (match) {
                    req.session.admin = { id: admin._id, username: admin.username };
                    return res.redirect('/admin/founder-message');
                }
            }
        }

        return res.render('admin-login', { title: 'Admin Login — Solanki Industries', error: 'Invalid username or password' });
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
        const docs = await Project.find().sort({ order: 1, createdDate: -1 });
        const projects = docs.map(parseProject);
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects, activeTab: 'projects' });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects: [], activeTab: 'projects' });
    }
});

// Admin: Reorder projects (Drag-and-Drop / Batch update)
app.post('/admin/projects/reorder', async (req, res) => {
    try {
        const { projectIds } = req.body;
        if (Array.isArray(projectIds) && projectIds.length > 0) {
            const updates = projectIds.map((id, index) => 
                Project.findByIdAndUpdate(id, { order: index })
            );
            await Promise.all(updates);
            return res.json({ success: true, message: 'Project sequence updated successfully' });
        }
        res.status(400).json({ success: false, message: 'Invalid project list provided' });
    } catch (err) {
        console.error('Reorder Project Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update project sequence: ' + err.message });
    }
});

// Admin: Quick Move Single Project (Up / Down)
app.post('/admin/projects/move/:id/:direction', async (req, res) => {
    try {
        const { id, direction } = req.params;
        const projects = await Project.find().sort({ order: 1, createdDate: -1 });
        const currentIndex = projects.findIndex(p => p._id === id);
        
        if (currentIndex !== -1) {
            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex >= 0 && targetIndex < projects.length) {
                const [removed] = projects.splice(currentIndex, 1);
                projects.splice(targetIndex, 0, removed);
                const updates = projects.map((p, idx) => 
                    Project.findByIdAndUpdate(p._id, { order: idx })
                );
                await Promise.all(updates);
            }
        }
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true });
        }
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('Move Project Error:', err);
        res.redirect('/admin/projects');
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

        let order = parseInt(req.body.order, 10);
        if (isNaN(order)) {
            const highest = await Project.findOne().sort({ order: -1 });
            order = (highest && typeof highest.order === 'number') ? highest.order + 1 : 0;
        }

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
            order,
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

        let updateData = {
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
        };

        if (req.body.order !== undefined && req.body.order !== '') {
            const parsedOrder = parseInt(req.body.order, 10);
            if (!isNaN(parsedOrder)) {
                updateData.order = parsedOrder;
            }
        }

        await Project.findByIdAndUpdate(req.params.id, updateData);
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
        const products = await getProductsData();
        res.render('admin-products', { title: 'Admin — Manage Products', products, activeTab: 'products' });
    } catch (err) {
        console.error('Admin Products Error:', err);
        res.render('admin-products', { title: 'Admin — Manage Products', products: getDefaultProducts(), activeTab: 'products' });
    }
});

// Admin: Show add product page
app.get('/admin/products/add', (req, res) => {
    res.render('admin-product-form', { title: 'Add New Product', product: null, action: '/admin/products/add', activeTab: 'products' });
});

// Admin: Show edit product page
app.get('/admin/products/edit/:id', async (req, res) => {
    try {
        const product = await getProductById(req.params.id);
        if (!product) return res.status(404).send('Product not found');
        res.render('admin-product-form', { title: 'Edit Product', product, action: `/admin/products/edit/${product._id}`, activeTab: 'products' });
    } catch (err) {
        console.error('Admin Product Edit Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle add product POST
app.post('/admin/products/add', uploadProductImages, async (req, res) => {
    try {
        const {
            name,
            slug,
            tagline,
            headline,
            heroSubtitle,
            shortDescription,
            aboutTitle,
            aboutText,
            standards,
            sizeRange,
            pressureRating,
            materialGrade,
            videoUrl,
            videoTitle,
            videoDescription,
            animationUrl,
            animationTitle,
            animationSubtitle,
            link,
            badge
        } = req.body;
        const id = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const mainImage = req.files && req.files['mainImage'] ? `/images/uploads/${req.files['mainImage'][0].filename}` : '/images/product_01.png';
        const hoverImage = req.files && req.files['hoverImage'] ? `/images/uploads/${req.files['hoverImage'][0].filename}` : mainImage;
        const heroImage = req.files && req.files['heroImage'] ? `/images/uploads/${req.files['heroImage'][0].filename}` : '/images/Hdpe_hero.png';
        const detailImage = req.files && req.files['detailImage'] ? `/images/uploads/${req.files['detailImage'][0].filename}` : '/images/hdpepage.png';
        const bannerImage = req.files && req.files['bannerImage'] ? `/images/uploads/${req.files['bannerImage'][0].filename}` : '/images/hdpe_02.svg';

        const videoFile = req.files && req.files['videoFile'] ? `/images/uploads/${req.files['videoFile'][0].filename}` : '';
        const animationFile = req.files && req.files['animationFile'] ? `/images/uploads/${req.files['animationFile'][0].filename}` : '';

        const galleryImages = [
            req.files && req.files['gallery1'] ? `/images/uploads/${req.files['gallery1'][0].filename}` : '/images/hdpe-gallery-1.jpeg',
            req.files && req.files['gallery2'] ? `/images/uploads/${req.files['gallery2'][0].filename}` : '/images/hdpe-gallery-2.jpeg',
            req.files && req.files['gallery3'] ? `/images/uploads/${req.files['gallery3'][0].filename}` : '/images/hdpe-gallery-3.jpeg'
        ];

        const { features, specifications, applications } = parseProductFormArrays(req.body);

        await Product.create({
            _id: id,
            name,
            slug: id,
            tagline: tagline || 'Better pipe, Better life',
            headline: headline || name,
            heroSubtitle: heroSubtitle || shortDescription || '',
            shortDescription: shortDescription || '',
            aboutTitle: aboutTitle || `About ${name}`,
            aboutText: aboutText || '',
            standards: standards || '',
            sizeRange: sizeRange || '',
            pressureRating: pressureRating || '',
            materialGrade: materialGrade || '',
            mainImage,
            hoverImage,
            heroImage,
            detailImage,
            bannerImage,
            galleryImages,
            videoUrl: videoUrl || '',
            videoFile,
            videoTitle: videoTitle || '',
            videoDescription: videoDescription || '',
            animationUrl: animationUrl || '',
            animationFile,
            animationTitle: animationTitle || '',
            animationSubtitle: animationSubtitle || '',
            features,
            specifications,
            applications,
            link: link || `/${id}`,
            badge: badge || ''
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
        const {
            name,
            slug,
            tagline,
            headline,
            heroSubtitle,
            shortDescription,
            aboutTitle,
            aboutText,
            standards,
            sizeRange,
            pressureRating,
            materialGrade,
            videoUrl,
            videoTitle,
            videoDescription,
            animationUrl,
            animationTitle,
            animationSubtitle,
            link,
            badge
        } = req.body;
        const doc = await Product.findById(req.params.id);
        if (!doc) return res.status(404).send('Product not found');

        let mainImage = doc.mainImage;
        let hoverImage = doc.hoverImage;
        let heroImage = doc.heroImage;
        let detailImage = doc.detailImage;
        let bannerImage = doc.bannerImage || '/images/hdpe_02.svg';
        let videoFile = doc.videoFile || '';
        let animationFile = doc.animationFile || '';
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
            if (req.files['videoFile']) videoFile = `/images/uploads/${req.files['videoFile'][0].filename}`;
            if (req.files['animationFile']) animationFile = `/images/uploads/${req.files['animationFile'][0].filename}`;
        }

        const { features, specifications, applications } = parseProductFormArrays(req.body);

        await Product.findByIdAndUpdate(req.params.id, {
            name,
            slug: slug || doc.slug,
            tagline: tagline !== undefined ? tagline : doc.tagline,
            headline: headline !== undefined ? headline : doc.headline,
            heroSubtitle: heroSubtitle !== undefined ? heroSubtitle : doc.heroSubtitle,
            shortDescription: shortDescription !== undefined ? shortDescription : doc.shortDescription,
            aboutTitle: aboutTitle !== undefined ? aboutTitle : doc.aboutTitle,
            aboutText: aboutText !== undefined ? aboutText : doc.aboutText,
            standards: standards !== undefined ? standards : doc.standards,
            sizeRange: sizeRange !== undefined ? sizeRange : doc.sizeRange,
            pressureRating: pressureRating !== undefined ? pressureRating : doc.pressureRating,
            materialGrade: materialGrade !== undefined ? materialGrade : doc.materialGrade,
            mainImage,
            hoverImage,
            heroImage,
            detailImage,
            bannerImage,
            galleryImages,
            videoUrl: videoUrl !== undefined ? videoUrl : doc.videoUrl,
            videoFile,
            videoTitle: videoTitle !== undefined ? videoTitle : doc.videoTitle,
            videoDescription: videoDescription !== undefined ? videoDescription : doc.videoDescription,
            animationUrl: animationUrl !== undefined ? animationUrl : doc.animationUrl,
            animationFile,
            animationTitle: animationTitle !== undefined ? animationTitle : doc.animationTitle,
            animationSubtitle: animationSubtitle !== undefined ? animationSubtitle : doc.animationSubtitle,
            features: features.length > 0 ? features : (doc.features || []),
            specifications: specifications.length > 0 ? specifications : (doc.specifications || []),
            applications: applications.length > 0 ? applications : (doc.applications || []),
            link: link || `/${req.params.id}`,
            badge: badge !== undefined ? badge : doc.badge
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

// ==========================================
// ADMIN FOUNDER MESSAGE ROUTES
// ==========================================

// Admin: Show Founder's Message edit page
app.get('/admin/founder-message', async (req, res) => {
    try {
        const founderData = await getFounderMessage();
        res.render('admin-founder-message', { 
            title: 'Admin — Manage Founder Message', 
            data: founderData || defaultFounderMessage, 
            activeTab: 'founder-message' 
        });
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle Founder's Message POST
app.post('/admin/founder-message', uploadFounderMedia, async (req, res) => {
    try {
        let founderDoc = await FounderMessage.findById('default');
        if (!founderDoc) {
            founderDoc = new FounderMessage({ _id: 'default' });
        }

        const {
            bannerTagline,
            founderName,
            founderRole,
            founderQuote,
            categoryLabel,
            headlinePart1,
            headlinePart2,
            cursiveTagline,
            letterGreeting,
            letterParagraph1,
            letterParagraph2,
            letterParagraph3,
            signoffText,
            signatureName,
            signatureRole,
            signatureCompany,
            galleryTitle1,
            gallerySubtitle1,
            galleryTitle2,
            gallerySubtitle2,
            galleryTitle3,
            gallerySubtitle3,
            galleryTitle4,
            gallerySubtitle4
        } = req.body;

        if (bannerTagline !== undefined) founderDoc.bannerTagline = bannerTagline;
        if (founderName !== undefined) founderDoc.founderName = founderName;
        if (founderRole !== undefined) founderDoc.founderRole = founderRole;
        if (founderQuote !== undefined) founderDoc.founderQuote = founderQuote;
        if (categoryLabel !== undefined) founderDoc.categoryLabel = categoryLabel;
        if (headlinePart1 !== undefined) founderDoc.headlinePart1 = headlinePart1;
        if (headlinePart2 !== undefined) founderDoc.headlinePart2 = headlinePart2;
        if (cursiveTagline !== undefined) founderDoc.cursiveTagline = cursiveTagline;
        if (letterGreeting !== undefined) founderDoc.letterGreeting = letterGreeting;
        if (letterParagraph1 !== undefined) founderDoc.letterParagraph1 = letterParagraph1;
        if (letterParagraph2 !== undefined) founderDoc.letterParagraph2 = letterParagraph2;
        if (letterParagraph3 !== undefined) founderDoc.letterParagraph3 = letterParagraph3;
        if (signoffText !== undefined) founderDoc.signoffText = signoffText;
        if (signatureName !== undefined) founderDoc.signatureName = signatureName;
        if (signatureRole !== undefined) founderDoc.signatureRole = signatureRole;
        if (signatureCompany !== undefined) founderDoc.signatureCompany = signatureCompany;
        if (galleryTitle1 !== undefined) founderDoc.galleryTitle1 = galleryTitle1;
        if (gallerySubtitle1 !== undefined) founderDoc.gallerySubtitle1 = gallerySubtitle1;
        if (galleryTitle2 !== undefined) founderDoc.galleryTitle2 = galleryTitle2;
        if (gallerySubtitle2 !== undefined) founderDoc.gallerySubtitle2 = gallerySubtitle2;
        if (galleryTitle3 !== undefined) founderDoc.galleryTitle3 = galleryTitle3;
        if (gallerySubtitle3 !== undefined) founderDoc.gallerySubtitle3 = gallerySubtitle3;
        if (galleryTitle4 !== undefined) founderDoc.galleryTitle4 = galleryTitle4;
        if (gallerySubtitle4 !== undefined) founderDoc.gallerySubtitle4 = gallerySubtitle4;

        if (req.files) {
            if (req.files['founderImage']) founderDoc.founderImage = `/images/uploads/${req.files['founderImage'][0].filename}`;
            if (req.files['pipeFittingsImage']) founderDoc.pipeFittingsImage = `/images/uploads/${req.files['pipeFittingsImage'][0].filename}`;
            if (req.files['galleryImage1']) founderDoc.galleryImage1 = `/images/uploads/${req.files['galleryImage1'][0].filename}`;
            if (req.files['galleryImage2']) founderDoc.galleryImage2 = `/images/uploads/${req.files['galleryImage2'][0].filename}`;
            if (req.files['galleryImage3']) founderDoc.galleryImage3 = `/images/uploads/${req.files['galleryImage3'][0].filename}`;
            if (req.files['galleryImage4']) founderDoc.galleryImage4 = `/images/uploads/${req.files['galleryImage4'][0].filename}`;
        }

        // Sync in-memory fallback
        Object.keys(defaultFounderMessage).forEach(key => {
            if (req.body[key] !== undefined) defaultFounderMessage[key] = req.body[key];
        });
        if (req.files) {
            if (req.files['founderImage']) defaultFounderMessage.founderImage = `/images/uploads/${req.files['founderImage'][0].filename}`;
            if (req.files['pipeFittingsImage']) defaultFounderMessage.pipeFittingsImage = `/images/uploads/${req.files['pipeFittingsImage'][0].filename}`;
            if (req.files['galleryImage1']) defaultFounderMessage.galleryImage1 = `/images/uploads/${req.files['galleryImage1'][0].filename}`;
            if (req.files['galleryImage2']) defaultFounderMessage.galleryImage2 = `/images/uploads/${req.files['galleryImage2'][0].filename}`;
            if (req.files['galleryImage3']) defaultFounderMessage.galleryImage3 = `/images/uploads/${req.files['galleryImage3'][0].filename}`;
            if (req.files['galleryImage4']) defaultFounderMessage.galleryImage4 = `/images/uploads/${req.files['galleryImage4'][0].filename}`;
        }

        if (mongoose.connection.readyState === 1) {
            founderDoc.updatedAt = new Date();
            await founderDoc.save();
        }
        res.redirect('/admin/founder-message');
    } catch (err) {
        console.error('DB Error updating founder message:', err);
        res.redirect('/admin/founder-message');
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