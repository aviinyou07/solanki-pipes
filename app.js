const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { Project, Admin } = require('./db');
const session = require('express-session');
const bcrypt = require('bcryptjs');

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

// Route for the home page
app.get('/', (req, res) => {
    res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana' });
});
// Route for the about page
app.get('/about', (req, res) => {
    res.render('about', { title: 'About Solanki Industries' });
});

// Route for HDPE page
app.get('/hdpe', (req, res) => {
    res.render('hdpe', { title: 'HDPE Pipes (IS 4984) — Solanki Pipes' });
});

app.get('/hdpe-water', (req, res) => {
    res.render('hdpe', { title: 'HDPE Water Pipe — Solanki Pipes' });
});

app.get('/hdpe-sewerage', (req, res) => {
    res.render('hdpe-sewerage', { title: 'HDPE Sewerage Pipe — Solanki Pipes' });
});

app.get('/dwc-pipe', (req, res) => {
    res.render('dwc-pipe', { title: 'DWC Pipe — Solanki Pipes' });
});

app.get('/pvc-pipe', (req, res) => {
    res.render('pvc-pipe', { title: 'PVC Pipe — Solanki Pipes' });
});

// Route for the quality page
app.get('/quality', (req, res) => {
    res.render('quality', { title: 'Quality Assurance — Solanki Industries' });
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
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects: [] });
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});