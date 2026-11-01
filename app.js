const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const { mongoose, Project, Admin, Certification, Product, SiteSetting, FounderMessage, PageContent, Leader, LeadershipActionCard, LeadershipPageSetting, PopupSetting } = require('./db');
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
        // Clean up obsolete products (dwc-pipe, pvc-pipe)
        await Product.deleteMany({ _id: { $in: ['dwc-pipe', 'pvc-pipe'] } });

        // Normalize any legacy SPRINKLER uppercase document to lowercase
        const upperSprinkler = await Product.findById('SPRINKLER');
        const lowerSprinkler = await Product.findById('sprinkler');
        if (upperSprinkler && !lowerSprinkler) {
            const sprinklerObj = upperSprinkler.toObject();
            delete sprinklerObj.__v;
            sprinklerObj._id = 'sprinkler';
            sprinklerObj.slug = 'sprinkler';
            sprinklerObj.link = '/sprinkler';
            await Product.create(sprinklerObj);
            await Product.findByIdAndDelete('SPRINKLER');
            console.log('Normalized SPRINKLER id to lowercase sprinkler');
        } else if (upperSprinkler && lowerSprinkler) {
            await Product.findByIdAndDelete('SPRINKLER');
        }

        const productCount = await Product.countDocuments();
        if (productCount === 0) {
            const productsFilePath = path.join(__dirname, 'data', 'products.json');
            if (fs.existsSync(productsFilePath)) {
                const rawProducts = fs.readFileSync(productsFilePath, 'utf8');
                const productsData = JSON.parse(rawProducts);

                for (const p of productsData) {
                    const id = (p.id || p._id).toLowerCase();
                    const doc = { ...p, _id: id, slug: (p.slug || id).toLowerCase() };
                    delete doc.id;
                    await Product.create(doc);
                }
                console.log('Successfully auto-seeded initial products (HDPE and Sprinkler)');
            }
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
    catalogPdf: '/images/Catalog Solanki Pipes.pdf',
    phone1: '99921-77822',
    phone2: '94664-58070',
    whatsapp: '919992177822',
    email: 'sales@solankipipes.com',
    headOffice: 'Solanki Industries, Fatehabad Road, Mehuwala, Fatehabad, Haryana 125053',
    manufacturingUnit: 'Khasra No. 115//2/2, Sarsa Ghoghra, Bhiwani, Haryana 127021',
    facebook: 'https://facebook.com/solankipipes',
    instagram: 'https://instagram.com/solankipipes',
    linkedin: 'https://linkedin.com/company/solanki-pipes'
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
    leaders: [
        {
            name: 'Sukinder Solanki',
            role: 'Founder, Solanki Pipes',
            badge: 'Founder',
            quote: 'Building enduring water infrastructure that powers regional growth across North India.',
            image: '/images/sukinder_solanki.jpg'
        },
        {
            name: 'Satpal Solanki',
            role: 'Founder, Solanki Pipes',
            badge: 'Founder',
            quote: 'Uncompromising quality, continuous innovation, and trust built into every single pipe.',
            image: '/images/satpal_solanki.jpg'
        },
        {
            name: 'Sachin Solanki',
            role: 'Head of Operations, Solanki Pipes',
            badge: 'Head of Operations',
            quote: 'A pipe is laid once. It has to be right the first time.',
            image: '/images/sachin_solanki.jpg'
        }
    ],
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

// Helper: Read SiteSetting from disk
function getDefaultSiteSettings() {
    try {
        const filePath = path.join(__dirname, 'data', 'site-settings.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading default site-settings.json:', e);
    }
    return defaultSiteSettings;
}

// Helper: Save SiteSetting to disk & sync to DB
async function saveSiteSettings(updatedData) {
    try {
        const current = getDefaultSiteSettings();
        const merged = { ...current, ...updatedData };
        const filePath = path.join(__dirname, 'data', 'site-settings.json');
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');

        if (mongoose.connection.readyState === 1) {
            await SiteSetting.findByIdAndUpdate('default', merged, { upsert: true, new: true }).maxTimeMS(2500);
        }
        return merged;
    } catch (err) {
        console.error('Error saving SiteSettings:', err);
        return updatedData;
    }
}

// Helper: Get or initialize SiteSetting document
async function getSiteSettings() {
    const fallback = getDefaultSiteSettings();
    if (mongoose.connection.readyState === 1) {
        try {
            let settings = await SiteSetting.findById('default').maxTimeMS(2500);
            if (settings) return settings;
        } catch (err) {
            console.error('Error fetching SiteSettings from DB:', err.message);
        }
    }
    return fallback;
}

// Helper: Read FounderMessage from disk
function getDefaultFounderMessage() {
    try {
        const filePath = path.join(__dirname, 'data', 'founder-message.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading default founder-message.json:', e);
    }
    return defaultFounderMessage;
}

// Helper: Save FounderMessage to disk & sync to DB
async function saveFounderMessage(updatedData) {
    try {
        const current = getDefaultFounderMessage();
        const merged = { ...current, ...updatedData, updatedAt: new Date() };
        const filePath = path.join(__dirname, 'data', 'founder-message.json');
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');

        if (mongoose.connection.readyState === 1) {
            await FounderMessage.findByIdAndUpdate('default', merged, { upsert: true, new: true }).maxTimeMS(2500);
        }
        return merged;
    } catch (err) {
        console.error('Error saving FounderMessage:', err);
        throw err;
    }
}

// Helper: Get or initialize FounderMessage document
async function getFounderMessage() {
    const fallback = getDefaultFounderMessage();
    if (mongoose.connection.readyState === 1) {
        try {
            let doc = await FounderMessage.findById('default').maxTimeMS(2500);
            if (doc) return doc;
        } catch (err) {
            console.error('Error fetching FounderMessage from DB:', err.message);
        }
    }
    return fallback;
}

// Helper: Read LeadershipData from disk
function getDefaultLeadershipData() {
    try {
        const filePath = path.join(__dirname, 'data', 'leadership.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading default leadership.json:', e);
    }
    return {
        settings: {
            pageTitle: 'Leadership Messages',
            breadcrumbHome: 'Home',
            breadcrumbAbout: 'About Us',
            breadcrumbCurrent: 'Leadership Messages',
            tagline: 'PIPES FOR A STRONGER TOMORROW',
            showTagline: true,
            actionSubtitle: 'INFRASTRUCTURE & IMPACT',
            actionTitle: 'LEADERSHIP IN ACTION',
            actionLocationBadge: '• Fatehabad & Bhiwani Facilities',
            carousel: {
                autoplay: true,
                autoplaySpeed: 6000,
                pauseOnHover: true,
                showArrows: true,
                showDots: true,
                showLeaderTabs: true,
                transitionStyle: 'slide',
                transitionSpeed: 500,
                enableSwipe: true,
                defaultActiveSlide: 0
            }
        },
        leaders: [],
        actionCards: []
    };
}

// Helper: Save LeadershipData to disk & sync to DB and fallback files
async function saveLeadershipData(updatedData) {
    try {
        const current = getDefaultLeadershipData();
        const merged = {
            settings: { ...current.settings, ...(updatedData.settings || {}) },
            leaders: updatedData.leaders !== undefined ? updatedData.leaders : current.leaders,
            actionCards: updatedData.actionCards !== undefined ? updatedData.actionCards : current.actionCards,
            updatedAt: new Date()
        };
        const filePath = path.join(__dirname, 'data', 'leadership.json');
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');

        // Also sync backwards-compatible founder-message.json
        try {
            const founderPath = path.join(__dirname, 'data', 'founder-message.json');
            const primaryLeader = merged.leaders && merged.leaders.length > 0 ? merged.leaders[0] : null;
            if (primaryLeader) {
                const fmSync = {
                    bannerTagline: (merged.settings && merged.settings.tagline) || 'PIPES FOR A STRONGER TOMORROW',
                    founderName: primaryLeader.name,
                    founderRole: primaryLeader.designation,
                    founderQuote: primaryLeader.quote,
                    founderImage: primaryLeader.portraitImage,
                    categoryLabel: primaryLeader.roleLabel,
                    headlinePart1: primaryLeader.headline,
                    headlinePart2: primaryLeader.headlineHighlight,
                    letterGreeting: primaryLeader.greeting,
                    letterParagraph1: (primaryLeader.paragraphs && primaryLeader.paragraphs[0]) || '',
                    letterParagraph2: (primaryLeader.paragraphs && primaryLeader.paragraphs[1]) || '',
                    letterParagraph3: (primaryLeader.paragraphs && primaryLeader.paragraphs[2]) || '',
                    signoffText: primaryLeader.closing,
                    signatureName: primaryLeader.signatureName || primaryLeader.name,
                    signatureRole: primaryLeader.designation,
                    signatureCompany: primaryLeader.companyName,
                    pipeFittingsImage: primaryLeader.supportingImage,
                    leaders: merged.leaders.map(l => ({
                        name: l.name,
                        role: l.designation,
                        badge: l.designation,
                        quote: l.quote,
                        image: l.portraitImage
                    })),
                    updatedAt: new Date()
                };
                if (merged.actionCards && merged.actionCards.length > 0) {
                    merged.actionCards.slice(0, 4).forEach((ac, idx) => {
                        fmSync[`galleryImage${idx + 1}`] = ac.image;
                        fmSync[`galleryTitle${idx + 1}`] = ac.title;
                        fmSync[`gallerySubtitle${idx + 1}`] = ac.category;
                    });
                }
                fs.writeFileSync(founderPath, JSON.stringify(fmSync, null, 2), 'utf8');
            }
        } catch (fmErr) {
            console.error('Error syncing founder-message.json fallback:', fmErr);
        }

        // Sync to MongoDB in background if connected
        if (mongoose.connection.readyState === 1) {
            (async () => {
                try {
                    await LeadershipPageSetting.findByIdAndUpdate('default', {
                        _id: 'default',
                        ...merged.settings,
                        updatedAt: new Date()
                    }, { upsert: true }).maxTimeMS(2500);

                    if (Array.isArray(merged.leaders)) {
                        for (const ldr of merged.leaders) {
                            if (ldr.id) {
                                await Leader.findOneAndUpdate({ id: ldr.id }, ldr, { upsert: true }).maxTimeMS(2500);
                            }
                        }
                    }

                    if (Array.isArray(merged.actionCards)) {
                        for (const card of merged.actionCards) {
                            if (card.id) {
                                await LeadershipActionCard.findOneAndUpdate({ id: card.id }, card, { upsert: true }).maxTimeMS(2500);
                            }
                        }
                    }
                } catch (dbErr) {
                    console.warn('MongoDB sync notice for leadership:', dbErr.message);
                }
            })().catch(e => console.warn('Background sync warning:', e.message));
        }
        return merged;
    } catch (err) {
        console.error('Error saving LeadershipData to disk:', err);
        return getDefaultLeadershipData();
    }
}

// Helper: Get LeadershipData
async function getLeadershipData() {
    const fallback = getDefaultLeadershipData();
    if (mongoose.connection.readyState === 1) {
        try {
            const [settingsDoc, leadersDocs, actionDocs] = await Promise.all([
                LeadershipPageSetting.findById('default').maxTimeMS(2500).lean().catch(() => null),
                Leader.find().sort({ displayOrder: 1 }).maxTimeMS(2500).lean().catch(() => []),
                LeadershipActionCard.find().sort({ displayOrder: 1 }).maxTimeMS(2500).lean().catch(() => [])
            ]);

            if (settingsDoc || (leadersDocs && leadersDocs.length > 0) || (actionDocs && actionDocs.length > 0)) {
                return {
                    settings: settingsDoc ? { ...fallback.settings, ...settingsDoc } : fallback.settings,
                    leaders: (leadersDocs && leadersDocs.length > 0) ? leadersDocs : fallback.leaders,
                    actionCards: (actionDocs && actionDocs.length > 0) ? actionDocs : fallback.actionCards
                };
            }
        } catch (err) {
            console.warn('DB fetch notice for LeadershipData (using disk fallback):', err.message);
        }
    }
    return fallback;
}

// --- Leadership CRUD Helpers ---

async function getAllLeaders(onlyActive = false) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.leaders) ? data.leaders : [];
    if (onlyActive) {
        list = list.filter(l => l.status === 'active');
    }
    return list.sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
}

async function getLeaderById(id) {
    const data = await getLeadershipData();
    const list = Array.isArray(data.leaders) ? data.leaders : [];
    return list.find(l => l.id === id) || null;
}

async function saveLeaderItem(leaderData, fileMap = {}) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.leaders) ? [...data.leaders] : [];
    const isNew = !leaderData.id;
    const id = isNew ? `leader-${Date.now()}` : leaderData.id;

    // Process paragraphs: can be array or string separated by newlines
    let paragraphs = [];
    if (Array.isArray(leaderData.paragraphs)) {
        paragraphs = leaderData.paragraphs.map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
    } else if (typeof leaderData.paragraphs === 'string') {
        paragraphs = leaderData.paragraphs.split('\n\n').map(p => p.trim()).filter(Boolean);
        if (paragraphs.length <= 1 && leaderData.paragraphs.includes('\n')) {
            paragraphs = leaderData.paragraphs.split('\n').map(p => p.trim()).filter(Boolean);
        }
    }

    const existingIndex = list.findIndex(l => l.id === id);
    const existing = existingIndex !== -1 ? list[existingIndex] : {};

    const item = {
        id: id,
        name: leaderData.name !== undefined ? leaderData.name : (existing.name || 'New Leader'),
        designation: leaderData.designation !== undefined ? leaderData.designation : (existing.designation || ''),
        roleLabel: leaderData.roleLabel !== undefined ? leaderData.roleLabel : (existing.roleLabel || 'A MESSAGE FROM THE FOUNDER'),
        headline: leaderData.headline !== undefined ? leaderData.headline : (existing.headline || ''),
        headlineHighlight: leaderData.headlineHighlight !== undefined ? leaderData.headlineHighlight : (existing.headlineHighlight || ''),
        greeting: leaderData.greeting !== undefined ? leaderData.greeting : (existing.greeting || 'Dear Valued Customers, Partners and Well-wishers,'),
        paragraphs: paragraphs.length > 0 ? paragraphs : (existing.paragraphs && existing.paragraphs.length > 0 ? existing.paragraphs : ['Welcome to Solanki Pipes.']),
        quote: leaderData.quote !== undefined ? leaderData.quote : (existing.quote || ''),
        closing: leaderData.closing !== undefined ? leaderData.closing : (existing.closing || 'Warm regards,'),
        signature: fileMap['signatureImage'] || leaderData.signature || existing.signature || '',
        signatureName: leaderData.signatureName || leaderData.name || existing.signatureName || '',
        signatureType: leaderData.signatureType || existing.signatureType || 'typed',
        portraitImage: fileMap['portraitImage'] || leaderData.portraitImage || existing.portraitImage || '/images/sukinder_solanki.jpg',
        supportingImage: fileMap['supportingImage'] || leaderData.supportingImage || existing.supportingImage || '/images/pipe_fittings_render.jpg',
        companyName: leaderData.companyName !== undefined ? leaderData.companyName : (existing.companyName || 'SOLANKI PIPES'),
        socialLinks: {
            linkedin: leaderData.linkedin || (existing.socialLinks && existing.socialLinks.linkedin) || '',
            twitter: leaderData.twitter || (existing.socialLinks && existing.socialLinks.twitter) || '',
            email: leaderData.email || (existing.socialLinks && existing.socialLinks.email) || ''
        },
        displayOrder: leaderData.displayOrder !== undefined ? Number(leaderData.displayOrder) : (existing.displayOrder || (list.length + 1)),
        status: leaderData.status || existing.status || 'active',
        updatedAt: new Date()
    };

    if (existingIndex !== -1) {
        list[existingIndex] = item;
    } else {
        list.push(item);
    }

    list.sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
    await saveLeadershipData({ leaders: list });
    return item;
}

async function removeLeaderItem(id) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.leaders) ? [...data.leaders] : [];
    list = list.filter(l => l.id !== id);
    list.forEach((l, idx) => { l.displayOrder = idx + 1; });
    await saveLeadershipData({ leaders: list });
    if (mongoose.connection.readyState === 1) {
        try {
            await Leader.deleteOne({ id }).maxTimeMS(2500);
        } catch (e) {
            console.error('DB delete error for leader:', e.message);
        }
    }
    return true;
}

async function reorderLeadersList(orderedIds) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.leaders) ? [...data.leaders] : [];
    const reordered = [];
    orderedIds.forEach((id, index) => {
        const found = list.find(l => l.id === id);
        if (found) {
            found.displayOrder = index + 1;
            reordered.push(found);
        }
    });
    list.forEach(l => {
        if (!reordered.some(r => r.id === l.id)) {
            l.displayOrder = reordered.length + 1;
            reordered.push(l);
        }
    });
    await saveLeadershipData({ leaders: reordered });
    return reordered;
}

async function toggleLeaderActiveStatus(id, newStatus) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.leaders) ? [...data.leaders] : [];
    const item = list.find(l => l.id === id);
    if (!item) return null;
    item.status = newStatus !== undefined ? newStatus : (item.status === 'active' ? 'inactive' : 'active');
    item.updatedAt = new Date();
    await saveLeadershipData({ leaders: list });
    return item;
}

// --- Action Cards CRUD Helpers ---

async function getAllActionCards(onlyActive = false) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.actionCards) ? data.actionCards : [];
    if (onlyActive) {
        list = list.filter(c => c.status === 'active');
    }
    return list.sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
}

async function getActionCardById(id) {
    const data = await getLeadershipData();
    const list = Array.isArray(data.actionCards) ? data.actionCards : [];
    return list.find(c => c.id === id) || null;
}

async function saveActionCardItem(cardData, fileMap = {}) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.actionCards) ? [...data.actionCards] : [];
    const isNew = !cardData.id;
    const id = isNew ? `action-${Date.now()}` : cardData.id;

    const existingIndex = list.findIndex(c => c.id === id);
    const existing = existingIndex !== -1 ? list[existingIndex] : {};

    const item = {
        id: id,
        category: cardData.category !== undefined ? cardData.category : (existing.category || 'INFRASTRUCTURE'),
        title: cardData.title !== undefined ? cardData.title : (existing.title || 'Action Title'),
        description: cardData.description !== undefined ? cardData.description : (existing.description || ''),
        image: fileMap['cardImage'] || fileMap['image'] || cardData.image || existing.image || '/images/sp_img1.jpeg',
        displayOrder: cardData.displayOrder !== undefined ? Number(cardData.displayOrder) : (existing.displayOrder || (list.length + 1)),
        status: cardData.status || existing.status || 'active',
        updatedAt: new Date()
    };

    if (existingIndex !== -1) {
        list[existingIndex] = item;
    } else {
        list.push(item);
    }

    list.sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
    await saveLeadershipData({ actionCards: list });
    return item;
}

async function removeActionCardItem(id) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.actionCards) ? [...data.actionCards] : [];
    list = list.filter(c => c.id !== id);
    list.forEach((c, idx) => { c.displayOrder = idx + 1; });
    await saveLeadershipData({ actionCards: list });
    if (mongoose.connection.readyState === 1) {
        try {
            await LeadershipActionCard.deleteOne({ id }).maxTimeMS(2500);
        } catch (e) {
            console.error('DB delete error for action card:', e.message);
        }
    }
    return true;
}

async function reorderActionCardsList(orderedIds) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.actionCards) ? [...data.actionCards] : [];
    const reordered = [];
    orderedIds.forEach((id, index) => {
        const found = list.find(c => c.id === id);
        if (found) {
            found.displayOrder = index + 1;
            reordered.push(found);
        }
    });
    list.forEach(c => {
        if (!reordered.some(r => r.id === c.id)) {
            c.displayOrder = reordered.length + 1;
            reordered.push(c);
        }
    });
    await saveLeadershipData({ actionCards: reordered });
    return reordered;
}

async function toggleActionCardActiveStatus(id, newStatus) {
    const data = await getLeadershipData();
    let list = Array.isArray(data.actionCards) ? [...data.actionCards] : [];
    const item = list.find(c => c.id === id);
    if (!item) return null;
    item.status = newStatus !== undefined ? newStatus : (item.status === 'active' ? 'inactive' : 'active');
    item.updatedAt = new Date();
    await saveLeadershipData({ actionCards: list });
    return item;
}

async function updateLeadershipSettingsData(settingsData) {
    const data = await getLeadershipData();
    const currentSettings = data.settings || {};
    const updatedSettings = {
        ...currentSettings,
        ...(settingsData || {}),
        carousel: {
            ...(currentSettings.carousel || {}),
            ...((settingsData && settingsData.carousel) || {})
        }
    };
    await saveLeadershipData({ settings: updatedSettings });
    return updatedSettings;
}

// --- Promotional Popup Settings Helpers ---

const defaultPopupSettings = {
    _id: 'default',
    enabled: true,
    badgeText: 'Special Announcement',
    badgeColor: 'rose',
    title: 'High-Performance HDPE Pipes',
    titleHighlight: 'at Factory Best Prices!',
    description: 'Supplying BIS-licensed PE80 & PE100 HDPE water and sewerage pipes up to 1000 mm diameter directly from our Fatehabad & Bhiwani manufacturing plants.',
    image: '/images/sp_img1.jpeg',
    ctaText: 'Explore Products',
    ctaLink: '/hdpe',
    ctaTarget: '_self',
    ctaColor: 'emerald',
    displayFrequency: 'every_refresh',
    delaySeconds: 0.5,
    updatedAt: new Date()
};

function getDefaultPopupSettings() {
    try {
        const filePath = path.join(__dirname, 'data', 'popup-settings.json');
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error('Error reading default popup-settings.json:', e);
    }
    return defaultPopupSettings;
}

async function savePopupSettings(updatedData) {
    try {
        const current = getDefaultPopupSettings();
        const merged = { ...current, ...updatedData, updatedAt: new Date() };
        const filePath = path.join(__dirname, 'data', 'popup-settings.json');
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');

        if (mongoose.connection.readyState === 1) {
            (async () => {
                try {
                    await PopupSetting.findByIdAndUpdate('default', merged, { upsert: true, returnDocument: 'after' }).maxTimeMS(2500);
                } catch (dbErr) {
                    console.warn('MongoDB sync notice for PopupSetting:', dbErr.message);
                }
            })().catch(e => console.warn('Background sync warning for popup:', e.message));
        }
        return merged;
    } catch (err) {
        console.error('Error saving PopupSettings:', err);
        return updatedData;
    }
}

async function getPopupSettings() {
    const fallback = getDefaultPopupSettings();
    if (mongoose.connection.readyState === 1) {
        try {
            const doc = await PopupSetting.findById('default').maxTimeMS(2500).lean();
            if (doc) return { ...fallback, ...doc };
        } catch (err) {
            console.warn('DB fetch notice for PopupSetting (using disk fallback):', err.message);
        }
    }
    return fallback;
}

// Helper: Get fallback page content from data/page-content.json
function getDefaultPageData(pageId) {
    try {
        const filePath = path.join(__dirname, 'data', 'page-content.json');
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const allPages = JSON.parse(raw);
            if (pageId && allPages[pageId]) {
                return allPages[pageId];
            }
            return allPages;
        }
    } catch (e) {
        console.error(`Error reading default page-content.json for ${pageId}:`, e);
    }
    return {};
}

// Helper: Get page content with database priority and file fallback
async function getPageContent(pageId) {
    const defaultData = getDefaultPageData(pageId) || {};
    if (mongoose.connection.readyState === 1) {
        try {
            const doc = await PageContent.findById(pageId).maxTimeMS(2500);
            if (doc && doc.data) {
                return { ...defaultData, ...doc.data };
            }
        } catch (err) {
            console.error(`Error fetching PageContent for ${pageId}:`, err.message);
        }
    }
    return defaultData;
}

// Helper: Save page content to DB & sync to data/page-content.json
async function savePageContent(pageId, updatedData) {
    try {
        const filePath = path.join(__dirname, 'data', 'page-content.json');
        let allPages = {};
        if (fs.existsSync(filePath)) {
            try {
                allPages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (e) {
                allPages = {};
            }
        }
        allPages[pageId] = { ...(allPages[pageId] || {}), ...updatedData };
        fs.writeFileSync(filePath, JSON.stringify(allPages, null, 2), 'utf8');

        if (mongoose.connection.readyState === 1) {
            await PageContent.findByIdAndUpdate(
                pageId,
                { data: allPages[pageId], updatedAt: new Date() },
                { upsert: true, new: true }
            );
        }
    } catch (e) {
        console.error(`Error writing page-content.json for ${pageId}:`, e);
    }
}

// Helper: Read certifications from data/certifications.json
function getDefaultCertifications() {
    try {
        const filePath = path.join(__dirname, 'data', 'certifications.json');
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error('Error reading default certifications.json:', e);
    }
    return [];
}

// Helper: Sync certifications to file & DB
async function syncCertificationsToFile(certs) {
    try {
        const filePath = path.join(__dirname, 'data', 'certifications.json');
        fs.writeFileSync(filePath, JSON.stringify(certs, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving certifications to file:', e);
    }
}

async function getCertificationsData() {
    if (mongoose.connection.readyState === 1) {
        try {
            const certs = await Certification.find().sort({ createdDate: 1 }).maxTimeMS(2500);
            if (certs && certs.length > 0) return certs;
        } catch (e) {
            console.error('DB Error getting certifications:', e.message);
        }
    }
    return getDefaultCertifications();
}

async function addCertification(certData) {
    const certs = getDefaultCertifications();
    certs.push(certData);
    await syncCertificationsToFile(certs);
    if (mongoose.connection.readyState === 1) {
        try {
            await Certification.create(certData);
        } catch (e) {
            console.error('DB Error adding certification:', e.message);
        }
    }
}

async function updateCertification(id, updateData) {
    const certs = getDefaultCertifications();
    const idx = certs.findIndex(c => (c._id === id || c.id === id));
    if (idx !== -1) {
        certs[idx] = { ...certs[idx], ...updateData };
        await syncCertificationsToFile(certs);
    }
    if (mongoose.connection.readyState === 1) {
        try {
            await Certification.findByIdAndUpdate(id, updateData).maxTimeMS(2500);
        } catch (e) {
            console.error('DB Error updating certification:', e.message);
        }
    }
}

async function deleteCertification(id) {
    let certs = getDefaultCertifications();
    certs = certs.filter(c => (c._id !== id && c.id !== id));
    await syncCertificationsToFile(certs);
    if (mongoose.connection.readyState === 1) {
        try {
            await Certification.findByIdAndDelete(id).maxTimeMS(2500);
        } catch (e) {
            console.error('DB Error deleting certification:', e.message);
        }
    }
}

// Helper: Read projects from data/projects.json
function getDefaultProjects() {
    try {
        const filePath = path.join(__dirname, 'data', 'projects.json');
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);
            return data.map((p, idx) => ({
                ...p,
                _id: p._id || p.id,
                id: p.id || p._id,
                order: (typeof p.order === 'number') ? p.order : idx
            }));
        }
    } catch (e) {
        console.error('Error reading default projects.json:', e);
    }
    return [];
}

async function syncProjectsToFile(projects) {
    try {
        const filePath = path.join(__dirname, 'data', 'projects.json');
        fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving projects to file:', e);
    }
}

async function getProjectsData() {
    if (mongoose.connection.readyState === 1) {
        try {
            const docs = await Project.find().sort({ order: 1, createdDate: -1 }).maxTimeMS(2500);
            if (docs && docs.length > 0) return docs;
        } catch (e) {
            console.error('DB Error getting projects:', e.message);
        }
    }
    return getDefaultProjects();
}

async function getProjectById(id) {
    if (!id) return null;
    const lowerId = id.toString().toLowerCase();
    if (mongoose.connection.readyState === 1) {
        try {
            const doc = await Project.findOne({
                $or: [{ _id: id }, { _id: lowerId }]
            }).maxTimeMS(2500);
            if (doc) return parseProject(doc);
        } catch (e) {
            console.error('DB Error finding project:', e.message);
        }
    }
    const projects = getDefaultProjects();
    const found = projects.find(p => (p._id === id || p.id === id || (p._id && p._id.toLowerCase() === lowerId)));
    return found ? parseProject(found) : null;
}

async function addProject(projectData) {
    const projects = getDefaultProjects();
    projects.push(projectData);
    await syncProjectsToFile(projects);
    if (mongoose.connection.readyState === 1) {
        try {
            await Project.create(projectData);
        } catch (e) {
            console.error('DB Error adding project:', e.message);
        }
    }
}

async function updateProject(id, updateData) {
    const projects = getDefaultProjects();
    const idx = projects.findIndex(p => (p._id === id || p.id === id));
    if (idx !== -1) {
        projects[idx] = { ...projects[idx], ...updateData };
        await syncProjectsToFile(projects);
    }
    if (mongoose.connection.readyState === 1) {
        try {
            await Project.findByIdAndUpdate(id, updateData).maxTimeMS(2500);
        } catch (e) {
            console.error('DB Error updating project:', e.message);
        }
    }
}

async function deleteProject(id) {
    let projects = getDefaultProjects();
    projects = projects.filter(p => (p._id !== id && p.id !== id));
    await syncProjectsToFile(projects);
    if (mongoose.connection.readyState === 1) {
        try {
            await Project.findByIdAndDelete(id).maxTimeMS(2500);
        } catch (e) {
            console.error('DB Error deleting project:', e.message);
        }
    }
}

async function reorderProjects(projectIds) {
    const projects = getDefaultProjects();
    const reordered = [];
    projectIds.forEach((id, index) => {
        const found = projects.find(p => (p._id === id || p.id === id));
        if (found) {
            found.order = index;
            reordered.push(found);
        }
    });
    // Add any remaining
    projects.forEach(p => {
        if (!reordered.some(r => r._id === p._id)) {
            p.order = reordered.length;
            reordered.push(p);
        }
    });
    await syncProjectsToFile(reordered);
    if (mongoose.connection.readyState === 1) {
        try {
            const updates = projectIds.map((id, index) => Project.findByIdAndUpdate(id, { order: index }).maxTimeMS(2500));
            await Promise.all(updates);
        } catch (e) {
            console.error('DB Error reordering projects:', e.message);
        }
    }
}

async function moveProject(id, direction) {
    const projects = getDefaultProjects().sort((a, b) => (a.order || 0) - (b.order || 0));
    const currentIndex = projects.findIndex(p => (p._id === id || p.id === id));
    if (currentIndex !== -1) {
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex >= 0 && targetIndex < projects.length) {
            const [removed] = projects.splice(currentIndex, 1);
            projects.splice(targetIndex, 0, removed);
            projects.forEach((p, idx) => { p.order = idx; });
            await syncProjectsToFile(projects);
            if (mongoose.connection.readyState === 1) {
                try {
                    const updates = projects.map((p, idx) => Project.findByIdAndUpdate(p._id, { order: idx }).maxTimeMS(2500));
                    await Promise.all(updates);
                } catch (e) {
                    console.error('DB Error moving project:', e.message);
                }
            }
        }
    }
}

// Fallback products parser and helper
function getDefaultProducts() {
    try {
        const productsFilePath = path.join(__dirname, 'data', 'products.json');
        if (fs.existsSync(productsFilePath)) {
            const rawProducts = fs.readFileSync(productsFilePath, 'utf8');
            const data = JSON.parse(rawProducts);
            return data.map(p => {
                const pid = (p.id || p._id || '').toLowerCase();
                return { ...p, _id: pid, id: pid, slug: (p.slug || pid).toLowerCase() };
            });
        }
    } catch (e) {
        console.error('Error reading default products.json:', e);
    }
    return [];
}

function syncProductToFile(productData) {
    try {
        const productsFilePath = path.join(__dirname, 'data', 'products.json');
        let products = [];
        if (fs.existsSync(productsFilePath)) {
            try {
                products = JSON.parse(fs.readFileSync(productsFilePath, 'utf8'));
            } catch (e) {
                products = [];
            }
        }
        const pid = (productData._id || productData.id || '').toLowerCase();
        const index = products.findIndex(p => (p.id || p._id || '').toLowerCase() === pid);
        const cleanProduct = { ...productData };
        if (cleanProduct._id) delete cleanProduct._id;
        cleanProduct.id = pid;

        if (index !== -1) {
            products[index] = { ...products[index], ...cleanProduct };
        } else {
            products.push(cleanProduct);
        }
        fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2), 'utf8');
    } catch (e) {
        console.error('Error synchronizing product to products.json:', e);
    }
}

async function getProductsData() {
    if (mongoose.connection.readyState === 1) {
        try {
            const docs = await Product.find().sort({ createdDate: 1 }).maxTimeMS(2500);
            if (docs && docs.length > 0) return docs;
        } catch (err) {
            console.error('Error fetching Products from DB:', err.message);
        }
    }
    return getDefaultProducts();
}

async function getProductById(id) {
    if (!id) return null;
    const lowerId = id.toString().toLowerCase();
    const upperId = id.toString().toUpperCase();

    if (mongoose.connection.readyState === 1) {
        try {
            const doc = await Product.findOne({
                $or: [
                    { _id: id },
                    { _id: lowerId },
                    { _id: upperId },
                    { slug: id },
                    { slug: lowerId },
                    { slug: upperId }
                ]
            }).maxTimeMS(2500);
            if (doc) return doc;
        } catch (err) {
            console.error(`Error fetching Product ${id} from DB:`, err.message);
        }
    }

    const defaults = getDefaultProducts();
    return defaults.find(p => {
        const pId = (p._id || p.id || '').toString().toLowerCase();
        const pSlug = (p.slug || '').toString().toLowerCase();
        return pId === lowerId || pSlug === lowerId;
    }) || null;
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
    { name: 'leaderImage1', maxCount: 1 },
    { name: 'leaderImage2', maxCount: 1 },
    { name: 'leaderImage3', maxCount: 1 },
    { name: 'leaderImage_0', maxCount: 1 },
    { name: 'leaderImage_1', maxCount: 1 },
    { name: 'leaderImage_2', maxCount: 1 },
    { name: 'pipeFittingsImage', maxCount: 1 },
    { name: 'galleryImage1', maxCount: 1 },
    { name: 'galleryImage2', maxCount: 1 },
    { name: 'galleryImage3', maxCount: 1 },
    { name: 'galleryImage4', maxCount: 1 }
]);

const uploadLeadershipMedia = upload.fields([
    { name: 'portraitImage', maxCount: 1 },
    { name: 'signatureImage', maxCount: 1 },
    { name: 'supportingImage', maxCount: 1 },
    { name: 'cardImage', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]);

const uploadPopupMedia = upload.fields([
    { name: 'popupImage', maxCount: 1 },
    { name: 'image', maxCount: 1 }
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

// Persistent Session Store: ensures admin sessions survive server restarts/nodemon reloads
class FileSessionStore extends session.Store {
    constructor(options = {}) {
        super();
        this.dir = options.dir || path.join(__dirname, 'data', 'sessions');
        if (!fs.existsSync(this.dir)) {
            try {
                fs.mkdirSync(this.dir, { recursive: true });
            } catch (e) {
                console.error('Could not create sessions directory:', e);
            }
        }
    }

    _getFilePath(sid) {
        const safeSid = sid.replace(/[^a-zA-Z0-9_-]/g, '');
        return path.join(this.dir, `${safeSid}.json`);
    }

    get(sid, cb) {
        try {
            const filePath = this._getFilePath(sid);
            if (!fs.existsSync(filePath)) {
                return cb(null, null);
            }
            const data = fs.readFileSync(filePath, 'utf8');
            const sess = JSON.parse(data);
            if (sess && sess.cookie && sess.cookie.expires) {
                if (new Date(sess.cookie.expires) <= new Date()) {
                    this.destroy(sid, () => {});
                    return cb(null, null);
                }
            }
            return cb(null, sess);
        } catch (err) {
            return cb(null, null);
        }
    }

    set(sid, sess, cb) {
        try {
            const filePath = this._getFilePath(sid);
            fs.writeFileSync(filePath, JSON.stringify(sess), 'utf8');
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    destroy(sid, cb) {
        try {
            const filePath = this._getFilePath(sid);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    }

    touch(sid, sess, cb) {
        this.set(sid, sess, cb);
    }
}

// Session middleware with persistent FileSessionStore
app.use(session({
    store: new FileSessionStore(),
    secret: 'solanki-pipes-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days persistent session
        httpOnly: true,
        sameSite: 'lax',
        secure: false
    }
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
        const pageData = await getPageContent('home');
        const popupSettings = await getPopupSettings();
        let projects = [];
        try {
            if (mongoose.connection.readyState === 1) {
                const docs = await Project.find().sort({ order: 1, createdDate: -1 }).maxTimeMS(2500);
                projects = docs.map(parseProject);
            }
        } catch (pe) {
            console.error('Home Page Projects Error:', pe);
        }
        res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana', products, projects, pageData, popupSettings });
    } catch (err) {
        console.error('Home Page Error:', err);
        res.render('index', { title: 'Solanki Pipes — HDPE Pipe Manufacturer, Haryana', products: getDefaultProducts(), projects: [], pageData: getDefaultPageData('home'), popupSettings: getDefaultPopupSettings() });
    }
});
// Route for the about page
app.get('/about', async (req, res) => {
    try {
        const pageData = await getPageContent('about');
        res.render('about', { title: 'About Solanki Industries', pageData });
    } catch (err) {
        console.error('About Page Error:', err);
        res.render('about', { title: 'About Solanki Industries', pageData: getDefaultPageData('about') });
    }
});

// Route for Leadership Messages page
app.get('/leadership-messages', async (req, res) => {
    try {
        const leadershipData = await getLeadershipData();
        const pageTitle = (leadershipData.settings && leadershipData.settings.pageTitle)
            ? `${leadershipData.settings.pageTitle} — Solanki Pipes`
            : "Leadership Messages — Solanki Pipes";
        res.render('leadership-messages', {
            title: pageTitle,
            data: leadershipData
        });
    } catch (err) {
        console.error('Error loading leadership messages:', err);
        const fallback = getDefaultLeadershipData();
        res.render('leadership-messages', {
            title: "Leadership Messages — Solanki Pipes",
            data: fallback
        });
    }
});

// Route for founder message page (backward compatibility)
app.get('/founder-message', async (req, res) => {
    try {
        const leadershipData = await getLeadershipData();
        const pageTitle = (leadershipData.settings && leadershipData.settings.pageTitle)
            ? `${leadershipData.settings.pageTitle} — Solanki Pipes`
            : "Leadership Messages — Solanki Pipes";
        res.render('leadership-messages', {
            title: pageTitle,
            data: leadershipData
        });
    } catch (err) {
        console.error('Error loading founder message:', err);
        res.redirect('/leadership-messages');
    }
});

app.get('/founder', (req, res) => {
    res.redirect('/leadership-messages');
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

// Generic product route for any product by slug or id
app.get(['/product/:id', '/products/:id'], async (req, res, next) => {
    try {
        const product = await getProductById(req.params.id);
        if (!product) return next();
        const products = await getProductsData();
        const slug = (product.slug || product._id || '').toLowerCase();
        if (slug.includes('sprinkler')) {
            return res.render('sprinkler', { title: `${product.name} — Solanki Pipes`, product, products });
        }
        return res.render('hdpe', { title: `${product.name} — Solanki Pipes`, product, products });
    } catch (err) {
        next();
    }
});

// Route for the quality page
app.get('/quality', async (req, res) => {
    try {
        const certifications = await Certification.find().sort({ createdDate: 1 });
        const pageData = await getPageContent('quality');
        res.render('quality', { title: 'Quality Assurance — Solanki Industries', certifications, pageData });
    } catch (err) {
        console.error('Error fetching certifications:', err);
        res.render('quality', { title: 'Quality Assurance — Solanki Industries', certifications: [], pageData: getDefaultPageData('quality') });
    }
});

// Route for downloads page
app.get('/downloads', async (req, res) => {
    try {
        const pageData = await getPageContent('downloads');
        res.render('downloads', { title: 'Download Center — Solanki Industries', pageData });
    } catch (err) {
        console.error('Downloads Page Error:', err);
        res.render('downloads', { title: 'Download Center — Solanki Industries', pageData: getDefaultPageData('downloads') });
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
        const pageData = await getPageContent('projects');
        res.render('projects', { title: 'Projects & Case Studies — Solanki Industries', projects, pageData });
    } catch (err) {
        console.error('DB Error:', err);
        res.render('projects', { title: 'Projects & Case Studies — Solanki Industries', projects: [], pageData: getDefaultPageData('projects') });
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
            return req.session.save((err) => {
                if (err) console.error('Session save error:', err);
                res.redirect('/admin/leadership-messages');
            });
        }

        if (mongoose.connection.readyState === 1) {
            const admin = await Admin.findOne({ username }).maxTimeMS(2000);
            if (admin) {
                const match = await bcrypt.compare(password, admin.password);
                if (match) {
                    req.session.admin = { id: admin._id, username: admin.username };
                    return req.session.save((err) => {
                        if (err) console.error('Session save error:', err);
                        res.redirect('/admin/leadership-messages');
                    });
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
    if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
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
        const docs = await getProjectsData();
        const projects = docs.map(parseProject);
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects, activeTab: 'projects' });
    } catch (err) {
        console.error('Admin projects error:', err);
        const fallback = getDefaultProjects();
        res.render('admin-projects', { title: 'Admin — Manage Projects', projects: fallback.map(parseProject), activeTab: 'projects' });
    }
});

// Admin: Reorder projects (Drag-and-Drop / Batch update)
app.post('/admin/projects/reorder', async (req, res) => {
    try {
        const { projectIds } = req.body;
        if (Array.isArray(projectIds) && projectIds.length > 0) {
            await reorderProjects(projectIds);
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
        await moveProject(id, direction);
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
        const project = await getProjectById(req.params.id);
        if (!project) return res.status(404).send('Project not found');
        res.render('admin-project-form', { title: 'Edit Project', project, action: `/admin/projects/edit/${project.id || project._id}` });
    } catch (err) {
        console.error('Admin Edit Project Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Show view project page (read-only detail from admin)
app.get('/admin/projects/view/:id', async (req, res) => {
    try {
        const project = await getProjectById(req.params.id);
        if (!project) return res.status(404).send('Project not found');
        res.render('project-detail', { title: `${project.title} — Solanki Pipes`, project });
    } catch (err) {
        console.error('Admin View Project Error:', err);
        res.status(500).send('Server error');
    }
});

// Admin: Handle add project POST
app.post('/admin/projects/add', upload.single('image'), async (req, res) => {
    try {
        const { title, shortDescription, longDescription, category, location, department, segment, execution, specsDescription, specsFootnote, outcomeTitle, outcomeDescription, outcomeBtnText, outcomeBtnLink } = req.body;
        const id = (title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || ('project-' + Date.now());
        const image = req.file ? `/images/uploads/${req.file.filename}` : '/images/project_1.jpg';
        const { specifications, executionSteps, inspections } = parseFormArrays(req.body);

        const currentProjects = getDefaultProjects();
        const newProject = {
            _id: id,
            id: id,
            title,
            shortDescription: shortDescription || '',
            longDescription: longDescription || '',
            image,
            category: category || '',
            location: location || '',
            department: department || '',
            segment: segment || '',
            execution: execution || '',
            specsDescription: specsDescription || '',
            specifications,
            specsFootnote: specsFootnote || '',
            executionSteps,
            inspections,
            outcomeTitle: outcomeTitle || '',
            outcomeDescription: outcomeDescription || '',
            outcomeBtnText: outcomeBtnText || '',
            outcomeBtnLink: outcomeBtnLink || '',
            order: currentProjects.length,
            createdDate: new Date()
        };

        await addProject(newProject);
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('Admin Add Project Error:', err);
        res.status(500).send('Failed to add project: ' + err.message);
    }
});

// Admin: Handle edit project POST
app.post('/admin/projects/edit/:id', upload.single('image'), async (req, res) => {
    try {
        const { title, shortDescription, longDescription, category, location, department, segment, execution, specsDescription, specsFootnote, outcomeTitle, outcomeDescription, outcomeBtnText, outcomeBtnLink } = req.body;
        const { specifications, executionSteps, inspections } = parseFormArrays(req.body);

        let updateData = {
            title,
            shortDescription: shortDescription || '',
            longDescription: longDescription || '',
            category: category || '',
            location: location || '',
            department: department || '',
            segment: segment || '',
            execution: execution || '',
            specsDescription: specsDescription || '',
            specifications,
            specsFootnote: specsFootnote || '',
            executionSteps,
            inspections,
            outcomeTitle: outcomeTitle || '',
            outcomeDescription: outcomeDescription || '',
            outcomeBtnText: outcomeBtnText || '',
            outcomeBtnLink: outcomeBtnLink || ''
        };

        if (req.file) {
            updateData.image = `/images/uploads/${req.file.filename}`;
        }

        await updateProject(req.params.id, updateData);
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('Admin Update Project Error:', err);
        res.status(500).send('Failed to update project: ' + err.message);
    }
});

// Admin: Handle delete project POST
app.post('/admin/projects/delete/:id', async (req, res) => {
    try {
        await deleteProject(req.params.id);
        res.redirect('/admin/projects');
    } catch (err) {
        console.error('Admin Delete Project Error:', err);
        res.status(500).send('Failed to delete project');
    }
});

// ==========================================
// ADMIN CERTIFICATION ROUTES
// ==========================================

// Admin: List all certifications
app.get('/admin/certifications', async (req, res) => {
    try {
        const certifications = await getCertificationsData();
        res.render('admin-certifications', { title: 'Admin - Manage Certifications', certifications, activeTab: 'certifications', query: req.query || {} });
    } catch (err) {
        console.error('Admin Certifications Error:', err);
        res.render('admin-certifications', { title: 'Admin - Manage Certifications', certifications: getDefaultCertifications(), activeTab: 'certifications', query: req.query || {} });
    }
});

// Admin: Show add certification page
app.get('/admin/certifications/add', (req, res) => {
    res.render('admin-certification-form', { title: 'Add New Certification', certification: null, action: '/admin/certifications/add', activeTab: 'certifications' });
});

// Admin: Show edit certification page
app.get('/admin/certifications/edit/:id', async (req, res) => {
    try {
        const certs = await getCertificationsData();
        const certification = certs.find(c => (c._id === req.params.id || c.id === req.params.id));
        if (!certification) return res.status(404).send('Certification not found');
        res.render('admin-certification-form', { title: 'Edit Certification', certification, action: `/admin/certifications/edit/${certification._id || certification.id}`, activeTab: 'certifications' });
    } catch (err) {
        console.error('Admin Edit Cert Error:', err);
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
        const newCert = {
            _id: 'cert-' + Date.now(),
            id: 'cert-' + Date.now(),
            title,
            subtitle: subtitle || '',
            badgeText: badgeText || '',
            noteText: noteText || '',
            iconType: iconType || 'shield-check',
            link,
            createdDate: new Date()
        };
        await addCertification(newCert);
        res.redirect('/admin/certifications');
    } catch (err) {
        console.error('Admin Add Cert Error:', err);
        res.redirect('/admin/certifications?error=' + encodeURIComponent(err.message));
    }
});

// Admin: Handle edit certification POST
app.post('/admin/certifications/edit/:id', upload.single('file'), async (req, res) => {
    try {
        const { title, subtitle, badgeText, noteText, iconType, externalLink } = req.body;
        let link;
        if (req.file) {
            link = `/images/uploads/${req.file.filename}`;
        } else if (externalLink !== undefined) {
            link = externalLink;
        }

        let updateData = {
            title,
            subtitle: subtitle || '',
            badgeText: badgeText || '',
            noteText: noteText || '',
            iconType: iconType || 'shield-check'
        };
        if (link !== undefined) updateData.link = link;

        await updateCertification(req.params.id, updateData);
        res.redirect('/admin/certifications');
    } catch (err) {
        console.error('Admin Update Cert Error:', err);
        res.redirect('/admin/certifications?error=' + encodeURIComponent(err.message));
    }
});

// Admin: Handle delete certification POST
app.post('/admin/certifications/delete/:id', async (req, res) => {
    try {
        await deleteCertification(req.params.id);
        res.redirect('/admin/certifications');
    } catch (err) {
        console.error('Admin Delete Cert Error:', err);
        res.redirect('/admin/certifications?error=' + encodeURIComponent(err.message));
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
        const id = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).toLowerCase();
        
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

        const newProduct = {
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
        };

        if (mongoose.connection.readyState === 1) {
            await Product.create(newProduct);
        }
        syncProductToFile(newProduct);
        res.redirect('/admin/products');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to add product: ' + err.message);
    }
});

// Admin: Handle edit product POST
app.post('/admin/products/edit/:id', uploadProductImages, async (req, res) => {
    try {
        const productId = req.params.id;
        const lowerId = productId.toString().toLowerCase();

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

        let doc = null;
        if (mongoose.connection.readyState === 1) {
            doc = await Product.findOne({
                $or: [
                    { _id: productId },
                    { _id: lowerId },
                    { _id: productId.toString().toUpperCase() },
                    { slug: productId },
                    { slug: lowerId }
                ]
            });
        }
        if (!doc) {
            const defaults = getDefaultProducts();
            const foundDefault = defaults.find(p => (p._id || p.id || '').toLowerCase() === lowerId);
            if (foundDefault && mongoose.connection.readyState === 1) {
                doc = await Product.create({ ...foundDefault, _id: lowerId, slug: foundDefault.slug || lowerId });
            } else if (foundDefault) {
                doc = foundDefault;
            }
        }
        if (!doc) return res.status(404).send('Product not found');

        let mainImage = doc.mainImage;
        let hoverImage = doc.hoverImage;
        let heroImage = doc.heroImage;
        let detailImage = doc.detailImage;
        let bannerImage = doc.bannerImage || '/images/hdpe_02.svg';
        let videoFile = doc.videoFile || '';
        let animationFile = doc.animationFile || '';
        let galleryImages = (doc.galleryImages && Array.isArray(doc.galleryImages)) ? [...doc.galleryImages] : ['/images/hdpe-gallery-1.jpeg', '/images/hdpe-gallery-2.jpeg', '/images/hdpe-gallery-3.jpeg'];
        while (galleryImages.length < 3) {
            galleryImages.push('/images/hdpe-gallery-1.jpeg');
        }

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

        const updatePayload = {
            name,
            slug: (slug || doc.slug || lowerId).toLowerCase(),
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
            features: (features && features.length > 0) ? features : (doc.features || []),
            specifications: (specifications && specifications.length > 0) ? specifications : (doc.specifications || []),
            applications: (applications && applications.length > 0) ? applications : (doc.applications || []),
            link: link || `/${lowerId}`,
            badge: badge !== undefined ? badge : doc.badge
        };

        if (mongoose.connection.readyState === 1 && doc._id) {
            await Product.findByIdAndUpdate(doc._id, updatePayload, { new: true });
        }

        // Also sync update to data/products.json for persistent fallback
        syncProductToFile({ ...updatePayload, _id: doc._id || lowerId });

        res.redirect('/admin/products');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to update product: ' + err.message);
    }
});

// Admin: Handle delete product POST
app.post('/admin/products/delete/:id', async (req, res) => {
    try {
        const lowerId = req.params.id.toLowerCase();
        if (mongoose.connection.readyState === 1) {
            await Product.deleteMany({
                $or: [{ _id: req.params.id }, { _id: lowerId }, { _id: req.params.id.toUpperCase() }, { slug: lowerId }]
            });
        }
        try {
            const productsFilePath = path.join(__dirname, 'data', 'products.json');
            if (fs.existsSync(productsFilePath)) {
                let products = JSON.parse(fs.readFileSync(productsFilePath, 'utf8'));
                products = products.filter(p => (p.id || p._id || '').toLowerCase() !== lowerId);
                fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2), 'utf8');
            }
        } catch (e) {
            console.error('Error removing product from json:', e.message);
        }
        res.redirect('/admin/products');
    } catch (err) {
        console.error('DB Error:', err);
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

        const { phone1, phone2, whatsapp, email, headOffice, manufacturingUnit, facebook, instagram, linkedin } = req.body;
        if (phone1 !== undefined) settings.phone1 = phone1;
        if (phone2 !== undefined) settings.phone2 = phone2;
        if (whatsapp !== undefined) settings.whatsapp = whatsapp;
        if (email !== undefined) settings.email = email;
        if (headOffice !== undefined) settings.headOffice = headOffice;
        if (manufacturingUnit !== undefined) settings.manufacturingUnit = manufacturingUnit;
        if (facebook !== undefined) settings.facebook = facebook;
        if (instagram !== undefined) settings.instagram = instagram;
        if (linkedin !== undefined) settings.linkedin = linkedin;

        await settings.save();
        res.redirect('/admin/settings');
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).send('Failed to update settings: ' + err.message);
    }
});

// ==========================================
// LEADERSHIP MESSAGES & ACTION CARDS API ROUTES
// ==========================================

// Public API: Get Active Leadership Data for public site / client rendering
app.get('/api/leadership', async (req, res) => {
    try {
        const data = await getLeadershipData();
        const activeLeaders = (Array.isArray(data.leaders) ? data.leaders : [])
            .filter(l => l.status === 'active')
            .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
        const activeActions = (Array.isArray(data.actionCards) ? data.actionCards : [])
            .filter(c => c.status === 'active')
            .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
        res.json({
            success: true,
            settings: data.settings || {},
            leaders: activeLeaders,
            actionCards: activeActions
        });
    } catch (err) {
        console.error('API /api/leadership error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin / All Leaders API
app.get('/api/leadership/all', async (req, res) => {
    try {
        const data = await getLeadershipData();
        res.json({
            success: true,
            settings: data.settings || {},
            leaders: data.leaders || [],
            actionCards: data.actionCards || []
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Reorder Leaders (MUST be defined before /:id)
app.post('/api/leadership/reorder', async (req, res) => {
    try {
        const { leaderIds } = req.body;
        if (!Array.isArray(leaderIds)) return res.status(400).json({ success: false, message: 'leaderIds array required' });
        const reordered = await reorderLeadersList(leaderIds);
        res.json({ success: true, message: 'Leader order updated successfully', leaders: reordered });
    } catch (err) {
        console.error('Reorder leaders error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Single Leader API
app.get('/api/leadership/:id', async (req, res) => {
    try {
        const leader = await getLeaderById(req.params.id);
        if (!leader) return res.status(404).json({ success: false, message: 'Leader not found' });
        res.json({ success: true, leader });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create Leader
app.post('/api/leadership', uploadLeadershipMedia, async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files ? Object.values(req.files).flat() : []);
        const saved = await saveLeaderItem(req.body, fileMap);
        res.json({ success: true, message: 'Leader added successfully', leader: saved });
    } catch (err) {
        console.error('Create leader error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Leader (supports PUT and POST)
const handleUpdateLeader = async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files ? Object.values(req.files).flat() : []);
        const updatePayload = { ...req.body, id: req.params.id };
        const saved = await saveLeaderItem(updatePayload, fileMap);
        res.json({ success: true, message: 'Leader updated successfully', leader: saved });
    } catch (err) {
        console.error('Update leader error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.put('/api/leadership/:id', uploadLeadershipMedia, handleUpdateLeader);
app.post('/api/leadership/:id', uploadLeadershipMedia, handleUpdateLeader);

// Delete Leader (supports DELETE and POST :id/delete)
const handleDeleteLeader = async (req, res) => {
    try {
        await removeLeaderItem(req.params.id);
        res.json({ success: true, message: 'Leader deleted successfully' });
    } catch (err) {
        console.error('Delete leader error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.delete('/api/leadership/:id', handleDeleteLeader);
app.post('/api/leadership/:id/delete', handleDeleteLeader);

// Toggle Leader Status
const handleToggleLeaderStatus = async (req, res) => {
    try {
        const updated = await toggleLeaderActiveStatus(req.params.id, req.body ? req.body.status : undefined);
        if (!updated) return res.status(404).json({ success: false, message: 'Leader not found' });
        res.json({ success: true, message: `Leader is now ${updated.status}`, leader: updated });
    } catch (err) {
        console.error('Toggle leader status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.patch('/api/leadership/:id/status', handleToggleLeaderStatus);
app.post('/api/leadership/:id/status', handleToggleLeaderStatus);

// --- Leadership in Action APIs ---

// Public API: Get Active Action Cards
app.get('/api/leadership-action', async (req, res) => {
    try {
        const cards = await getAllActionCards(true);
        res.json({ success: true, actionCards: cards });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// All Action Cards (admin)
app.get('/api/leadership-action/all', async (req, res) => {
    try {
        const cards = await getAllActionCards(false);
        res.json({ success: true, actionCards: cards });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Reorder Action Cards (MUST be defined before /:id)
app.post('/api/leadership-action/reorder', async (req, res) => {
    try {
        const { cardIds } = req.body;
        if (!Array.isArray(cardIds)) return res.status(400).json({ success: false, message: 'cardIds array required' });
        const reordered = await reorderActionCardsList(cardIds);
        res.json({ success: true, message: 'Action card order updated successfully', actionCards: reordered });
    } catch (err) {
        console.error('Reorder action cards error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Single Action Card
app.get('/api/leadership-action/:id', async (req, res) => {
    try {
        const card = await getActionCardById(req.params.id);
        if (!card) return res.status(404).json({ success: false, message: 'Card not found' });
        res.json({ success: true, actionCard: card });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create Action Card
app.post('/api/leadership-action', uploadLeadershipMedia, async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files ? Object.values(req.files).flat() : []);
        const saved = await saveActionCardItem(req.body, fileMap);
        res.json({ success: true, message: 'Action card added successfully', actionCard: saved });
    } catch (err) {
        console.error('Create action card error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update Action Card
const handleUpdateActionCard = async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files ? Object.values(req.files).flat() : []);
        const updatePayload = { ...req.body, id: req.params.id };
        const saved = await saveActionCardItem(updatePayload, fileMap);
        res.json({ success: true, message: 'Action card updated successfully', actionCard: saved });
    } catch (err) {
        console.error('Update action card error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.put('/api/leadership-action/:id', uploadLeadershipMedia, handleUpdateActionCard);
app.post('/api/leadership-action/:id', uploadLeadershipMedia, handleUpdateActionCard);

// Delete Action Card
const handleDeleteActionCard = async (req, res) => {
    try {
        await removeActionCardItem(req.params.id);
        res.json({ success: true, message: 'Action card deleted successfully' });
    } catch (err) {
        console.error('Delete action card error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.delete('/api/leadership-action/:id', handleDeleteActionCard);
app.post('/api/leadership-action/:id/delete', handleDeleteActionCard);

// Toggle Action Card Status
const handleToggleActionCardStatus = async (req, res) => {
    try {
        const updated = await toggleActionCardActiveStatus(req.params.id, req.body ? req.body.status : undefined);
        if (!updated) return res.status(404).json({ success: false, message: 'Card not found' });
        res.json({ success: true, message: `Card is now ${updated.status}`, actionCard: updated });
    } catch (err) {
        console.error('Toggle action card status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.patch('/api/leadership-action/:id/status', handleToggleActionCardStatus);
app.post('/api/leadership-action/:id/status', handleToggleActionCardStatus);

// --- Leadership Page & Carousel Settings API ---

app.get('/api/leadership-settings', async (req, res) => {
    try {
        const data = await getLeadershipData();
        res.json({ success: true, settings: data.settings || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

const handleUpdateLeadershipSettings = async (req, res) => {
    try {
        const updated = await updateLeadershipSettingsData(req.body);
        res.json({ success: true, message: 'Leadership settings updated successfully', settings: updated });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
app.put('/api/leadership-settings', handleUpdateLeadershipSettings);
app.post('/api/leadership-settings', handleUpdateLeadershipSettings);

// ==========================================
// ADMIN LEADERSHIP MESSAGES ROUTES
// ==========================================

// Admin: Show Leadership Messages Master Management Console
app.get('/admin/leadership-messages', async (req, res) => {
    try {
        const leadershipData = await getLeadershipData();
        res.render('admin-leadership-messages', {
            title: 'Admin — Manage Leadership Messages',
            data: leadershipData,
            activeTab: 'leadership-messages',
            query: req.query || {}
        });
    } catch (err) {
        console.error('Leadership admin load error:', err);
        const fallback = getDefaultLeadershipData();
        res.render('admin-leadership-messages', {
            title: 'Admin — Manage Leadership Messages',
            data: fallback,
            activeTab: 'leadership-messages',
            query: { error: err.message }
        });
    }
});

// Admin: Redirect /admin/founder-message to /admin/leadership-messages
app.get('/admin/founder-message', (req, res) => {
    const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect('/admin/leadership-messages' + queryStr);
});

// Admin: Handle Full Save from traditional form submission
app.post('/admin/leadership-messages/save-all', uploadLeadershipMedia, async (req, res) => {
    try {
        const currentData = await getLeadershipData();
        const fileMap = mapUploadedFiles(req.files ? Object.values(req.files).flat() : []);

        // Process Settings updates
        const updatedSettings = {
            ...currentData.settings,
            pageTitle: req.body.pageTitle || currentData.settings.pageTitle,
            breadcrumbHome: req.body.breadcrumbHome || currentData.settings.breadcrumbHome,
            breadcrumbAbout: req.body.breadcrumbAbout || currentData.settings.breadcrumbAbout,
            breadcrumbCurrent: req.body.breadcrumbCurrent || currentData.settings.breadcrumbCurrent,
            tagline: req.body.tagline !== undefined ? req.body.tagline : currentData.settings.tagline,
            showTagline: req.body.showTagline === 'true' || req.body.showTagline === true || req.body.showTagline === 'on',
            actionSubtitle: req.body.actionSubtitle || currentData.settings.actionSubtitle,
            actionTitle: req.body.actionTitle || currentData.settings.actionTitle,
            actionLocationBadge: req.body.actionLocationBadge || currentData.settings.actionLocationBadge,
            carousel: {
                ...currentData.settings.carousel,
                autoplay: req.body.carouselAutoplay === 'true' || req.body.carouselAutoplay === true || req.body.carouselAutoplay === 'on',
                autoplaySpeed: Number(req.body.carouselSpeed) || currentData.settings.carousel.autoplaySpeed,
                pauseOnHover: req.body.pauseOnHover === 'true' || req.body.pauseOnHover === true || req.body.pauseOnHover === 'on',
                showArrows: req.body.showArrows === 'true' || req.body.showArrows === true || req.body.showArrows === 'on',
                showDots: req.body.showDots === 'true' || req.body.showDots === true || req.body.showDots === 'on',
                showLeaderTabs: req.body.showLeaderTabs === 'true' || req.body.showLeaderTabs === true || req.body.showLeaderTabs === 'on',
                transitionStyle: req.body.transitionStyle || currentData.settings.carousel.transitionStyle,
                transitionSpeed: Number(req.body.transitionSpeed) || currentData.settings.carousel.transitionSpeed,
                enableSwipe: req.body.enableSwipe === 'true' || req.body.enableSwipe === true || req.body.enableSwipe === 'on',
                defaultActiveSlide: Number(req.body.defaultActiveSlide) || 0
            }
        };

        await saveLeadershipData({ settings: updatedSettings });

        if (req.session) {
            return req.session.save((err) => {
                if (err) console.error('Session save error on leadership save:', err);
                res.redirect('/admin/leadership-messages?saved=true');
            });
        }
        res.redirect('/admin/leadership-messages?saved=true');
    } catch (err) {
        console.error('Error saving all leadership messages:', err);
        res.redirect('/admin/leadership-messages?error=' + encodeURIComponent(err.message || 'Error saving changes'));
    }
});

// Admin: Also handle legacy POST to /admin/founder-message
app.post('/admin/founder-message', uploadLeadershipMedia, async (req, res) => {
    res.redirect(307, '/admin/leadership-messages/save-all');
});

// ==========================================
// ADMIN PAGE CONTENT CUSTOMIZER ROUTES
// ==========================================

// Helper: map uploaded files by fieldname
function mapUploadedFiles(files) {
    const fileMap = {};
    if (Array.isArray(files)) {
        files.forEach(f => {
            fileMap[f.fieldname] = `/images/uploads/${f.filename}`;
        });
    }
    return fileMap;
}

// Admin: Page Customizer Hub / Directory
app.get('/admin/pages', (req, res) => {
    res.render('admin-pages', {
        title: 'Admin — Page Content Customizer',
        activeTab: 'pages-hub'
    });
});

// Admin: Customize Home Page
app.get('/admin/pages/home', async (req, res) => {
    try {
        const data = await getPageContent('home');
        res.render('admin-page-home', {
            title: 'Admin — Customize Home Page',
            data,
            activeTab: 'page-home'
        });
    } catch (err) {
        console.error('Admin Home Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/home', upload.any(), async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files);
        const existingData = await getPageContent('home');

        const accordions = [];
        for (let i = 0; i < 4; i++) {
            if (req.body[`accTitle_${i}`] || req.body[`accContent_${i}`]) {
                accordions.push({
                    title: req.body[`accTitle_${i}`] || '',
                    content: req.body[`accContent_${i}`] || ''
                });
            }
        }

        const features = [];
        for (let i = 0; i < 4; i++) {
            if (req.body[`featTitle_${i}`] || req.body[`featDesc_${i}`]) {
                features.push({
                    title: req.body[`featTitle_${i}`] || '',
                    description: req.body[`featDesc_${i}`] || ''
                });
            }
        }

        const updated = {
            ...existingData,
            heroBadge: req.body.heroBadge !== undefined ? req.body.heroBadge : existingData.heroBadge,
            heroTitle: req.body.heroTitle !== undefined ? req.body.heroTitle : existingData.heroTitle,
            heroDescription: req.body.heroDescription !== undefined ? req.body.heroDescription : existingData.heroDescription,
            heroWhatsappText: req.body.heroWhatsappText !== undefined ? req.body.heroWhatsappText : existingData.heroWhatsappText,
            heroSlide2Badge: req.body.heroSlide2Badge !== undefined ? req.body.heroSlide2Badge : existingData.heroSlide2Badge,
            heroSlide2Title: req.body.heroSlide2Title !== undefined ? req.body.heroSlide2Title : existingData.heroSlide2Title,
            heroSlide2Description: req.body.heroSlide2Description !== undefined ? req.body.heroSlide2Description : existingData.heroSlide2Description,
            exploreTitle: req.body.exploreTitle !== undefined ? req.body.exploreTitle : existingData.exploreTitle,
            exploreHeading: req.body.exploreHeading !== undefined ? req.body.exploreHeading : existingData.exploreHeading,
            impactSubtitle: req.body.impactSubtitle !== undefined ? req.body.impactSubtitle : existingData.impactSubtitle,
            impactTitle: req.body.impactTitle !== undefined ? req.body.impactTitle : existingData.impactTitle,
            event1Badge: req.body.event1Badge !== undefined ? req.body.event1Badge : existingData.event1Badge,
            event1Title: req.body.event1Title !== undefined ? req.body.event1Title : existingData.event1Title,
            event1Link: req.body.event1Link !== undefined ? req.body.event1Link : existingData.event1Link,
            event1Image: fileMap['event1Image'] || existingData.event1Image,
            event2Badge: req.body.event2Badge !== undefined ? req.body.event2Badge : existingData.event2Badge,
            event2Title: req.body.event2Title !== undefined ? req.body.event2Title : existingData.event2Title,
            event2Link: req.body.event2Link !== undefined ? req.body.event2Link : existingData.event2Link,
            event2Image: fileMap['event2Image'] || existingData.event2Image,
            dhbvnHeading: req.body.dhbvnHeading !== undefined ? req.body.dhbvnHeading : existingData.dhbvnHeading,
            dhbvnSubheading: req.body.dhbvnSubheading !== undefined ? req.body.dhbvnSubheading : existingData.dhbvnSubheading,
            dhbvnParagraph1: req.body.dhbvnParagraph1 !== undefined ? req.body.dhbvnParagraph1 : existingData.dhbvnParagraph1,
            dhbvnParagraph2: req.body.dhbvnParagraph2 !== undefined ? req.body.dhbvnParagraph2 : existingData.dhbvnParagraph2,
            dhbvnCertificate: fileMap['dhbvnCertificate'] || existingData.dhbvnCertificate,
            dhbvnAccordions: accordions.length > 0 ? accordions : existingData.dhbvnAccordions,
            typingPrefix: req.body.typingPrefix !== undefined ? req.body.typingPrefix : existingData.typingPrefix,
            typingHighlight: req.body.typingHighlight !== undefined ? req.body.typingHighlight : existingData.typingHighlight,
            futureSectionTitle: req.body.futureSectionTitle !== undefined ? req.body.futureSectionTitle : existingData.futureSectionTitle,
            futureSectionDescription: req.body.futureSectionDescription !== undefined ? req.body.futureSectionDescription : existingData.futureSectionDescription,
            futureCta1Text: req.body.futureCta1Text !== undefined ? req.body.futureCta1Text : existingData.futureCta1Text,
            futureCta2Text: req.body.futureCta2Text !== undefined ? req.body.futureCta2Text : existingData.futureCta2Text,
            collectionBanner: fileMap['collectionBanner'] || existingData.collectionBanner,
            features: features.length > 0 ? features : existingData.features
        };

        await savePageContent('home', updated);
        res.redirect('/admin/pages/home');
    } catch (err) {
        console.error('Save Home Content Error:', err);
        res.redirect('/admin/pages/home');
    }
});

// Admin: Customize About Us Page
app.get('/admin/pages/about', async (req, res) => {
    try {
        const data = await getPageContent('about');
        res.render('admin-page-about', {
            title: 'Admin — Customize About Us Page',
            data,
            activeTab: 'page-about'
        });
    } catch (err) {
        console.error('Admin About Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/about', upload.any(), async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files);
        const existingData = await getPageContent('about');

        const values = [];
        for (let i = 0; i < 4; i++) {
            if (req.body[`valTitle_${i}`] || req.body[`valDesc_${i}`]) {
                values.push({
                    title: req.body[`valTitle_${i}`] || '',
                    description: req.body[`valDesc_${i}`] || ''
                });
            }
        }

        const updated = {
            ...existingData,
            introHeading: req.body.introHeading !== undefined ? req.body.introHeading : existingData.introHeading,
            introParagraph1: req.body.introParagraph1 !== undefined ? req.body.introParagraph1 : existingData.introParagraph1,
            introParagraph2: req.body.introParagraph2 !== undefined ? req.body.introParagraph2 : existingData.introParagraph2,
            companyCredentials: {
                legalEntity: req.body.legalEntity || (existingData.companyCredentials && existingData.companyCredentials.legalEntity) || '',
                gstin: req.body.gstin || (existingData.companyCredentials && existingData.companyCredentials.gstin) || '',
                bisLicence: req.body.bisLicence || (existingData.companyCredentials && existingData.companyCredentials.bisLicence) || '',
                brands: req.body.brands || (existingData.companyCredentials && existingData.companyCredentials.brands) || ''
            },
            sidebarImage1: fileMap['sidebarImage1'] || existingData.sidebarImage1,
            sidebarImage2: fileMap['sidebarImage2'] || existingData.sidebarImage2,
            bannerImage: fileMap['bannerImage'] || existingData.bannerImage,
            missionTitle: req.body.missionTitle !== undefined ? req.body.missionTitle : existingData.missionTitle,
            missionText: req.body.missionText !== undefined ? req.body.missionText : existingData.missionText,
            visionTitle: req.body.visionTitle !== undefined ? req.body.visionTitle : existingData.visionTitle,
            visionText: req.body.visionText !== undefined ? req.body.visionText : existingData.visionText,
            values: values.length > 0 ? values : existingData.values,
            infraTitle: req.body.infraTitle !== undefined ? req.body.infraTitle : existingData.infraTitle,
            infraText: req.body.infraText !== undefined ? req.body.infraText : existingData.infraText,
            infraImage1: fileMap['infraImage1'] || existingData.infraImage1,
            infraImage2: fileMap['infraImage2'] || existingData.infraImage2
        };

        await savePageContent('about', updated);
        res.redirect('/admin/pages/about');
    } catch (err) {
        console.error('Save About Content Error:', err);
        res.redirect('/admin/pages/about');
    }
});

// Admin: Customize Contact Us Page
app.get('/admin/pages/contact', async (req, res) => {
    try {
        const data = await getPageContent('contact');
        res.render('admin-page-contact', {
            title: 'Admin — Customize Contact Us Page',
            data,
            activeTab: 'page-contact'
        });
    } catch (err) {
        console.error('Admin Contact Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/contact', upload.none(), async (req, res) => {
    try {
        const existingData = await getPageContent('contact');
        const updated = {
            ...existingData,
            titlePart1: req.body.titlePart1 !== undefined ? req.body.titlePart1 : existingData.titlePart1,
            titlePart2: req.body.titlePart2 !== undefined ? req.body.titlePart2 : existingData.titlePart2,
            subtitle: req.body.subtitle !== undefined ? req.body.subtitle : existingData.subtitle,
            headOfficeTitle: req.body.headOfficeTitle !== undefined ? req.body.headOfficeTitle : existingData.headOfficeTitle,
            headOfficeFirm: req.body.headOfficeFirm !== undefined ? req.body.headOfficeFirm : existingData.headOfficeFirm,
            headOfficeAddress: req.body.headOfficeAddress !== undefined ? req.body.headOfficeAddress : existingData.headOfficeAddress,
            manufacturingTitle: req.body.manufacturingTitle !== undefined ? req.body.manufacturingTitle : existingData.manufacturingTitle,
            manufacturingAddress: req.body.manufacturingAddress !== undefined ? req.body.manufacturingAddress : existingData.manufacturingAddress,
            phone1: req.body.phone1 !== undefined ? req.body.phone1 : existingData.phone1,
            phone2: req.body.phone2 !== undefined ? req.body.phone2 : existingData.phone2,
            email: req.body.email !== undefined ? req.body.email : existingData.email,
            whatsappBtnText: req.body.whatsappBtnText !== undefined ? req.body.whatsappBtnText : existingData.whatsappBtnText,
            formHeading: req.body.formHeading !== undefined ? req.body.formHeading : existingData.formHeading,
            formSubheading: req.body.formSubheading !== undefined ? req.body.formSubheading : existingData.formSubheading,
            recipientEmail: req.body.recipientEmail !== undefined ? req.body.recipientEmail : existingData.recipientEmail
        };

        await savePageContent('contact', updated);
        res.redirect('/admin/pages/contact');
    } catch (err) {
        console.error('Save Contact Content Error:', err);
        res.redirect('/admin/pages/contact');
    }
});

// Admin: Customize Quality Page
app.get('/admin/pages/quality', async (req, res) => {
    try {
        const data = await getPageContent('quality');
        res.render('admin-page-quality', {
            title: 'Admin — Customize Quality Assurance Page',
            data,
            activeTab: 'page-quality'
        });
    } catch (err) {
        console.error('Admin Quality Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/quality', upload.any(), async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files);
        const existingData = await getPageContent('quality');

        const testingPillars = [];
        for (let i = 0; i < 3; i++) {
            if (req.body[`pillarTitle_${i}`] || req.body[`pillarTests_${i}`]) {
                const testsRaw = req.body[`pillarTests_${i}`] || '';
                const tests = testsRaw.split('\n').map(t => t.trim()).filter(Boolean);
                testingPillars.push({
                    title: req.body[`pillarTitle_${i}`] || '',
                    tests
                });
            }
        }

        const updated = {
            ...existingData,
            heroTitle: req.body.heroTitle !== undefined ? req.body.heroTitle : existingData.heroTitle,
            heroSubtitle: req.body.heroSubtitle !== undefined ? req.body.heroSubtitle : existingData.heroSubtitle,
            bannerImage: fileMap['bannerImage'] || existingData.bannerImage,
            imsText: req.body.imsText !== undefined ? req.body.imsText : existingData.imsText,
            quoteBannerText: req.body.quoteBannerText !== undefined ? req.body.quoteBannerText : existingData.quoteBannerText,
            testingSectionTitle: req.body.testingSectionTitle !== undefined ? req.body.testingSectionTitle : existingData.testingSectionTitle,
            testingPillars: testingPillars.length > 0 ? testingPillars : existingData.testingPillars
        };

        await savePageContent('quality', updated);
        res.redirect('/admin/pages/quality');
    } catch (err) {
        console.error('Save Quality Content Error:', err);
        res.redirect('/admin/pages/quality');
    }
});

// Admin: Customize Downloads Page
app.get('/admin/pages/downloads', async (req, res) => {
    try {
        const data = await getPageContent('downloads');
        res.render('admin-page-downloads', {
            title: 'Admin — Customize Downloads Page',
            data,
            activeTab: 'page-downloads'
        });
    } catch (err) {
        console.error('Admin Downloads Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/downloads', upload.any(), async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files);
        const existingData = await getPageContent('downloads');

        const docCount = parseInt(req.body.docCount, 10) || 20;
        const documents = [];

        for (let i = 0; i < docCount; i++) {
            if (req.body[`docTitle_${i}`]) {
                let fileUrl = req.body[`docUrl_${i}`] || '';
                if (fileMap[`docFile_${i}`]) {
                    fileUrl = fileMap[`docFile_${i}`];
                }
                documents.push({
                    id: String(i + 1),
                    icon: req.body[`docIcon_${i}`] || '📄',
                    title: req.body[`docTitle_${i}`],
                    description: req.body[`docDesc_${i}`] || '',
                    fileUrl
                });
            }
        }

        const updated = {
            ...existingData,
            headerTitle: req.body.headerTitle !== undefined ? req.body.headerTitle : existingData.headerTitle,
            headerSubtitle: req.body.headerSubtitle !== undefined ? req.body.headerSubtitle : existingData.headerSubtitle,
            documents: documents.length > 0 ? documents : existingData.documents
        };

        await savePageContent('downloads', updated);
        res.redirect('/admin/pages/downloads');
    } catch (err) {
        console.error('Save Downloads Content Error:', err);
        res.redirect('/admin/pages/downloads');
    }
});

// Admin: Customize Farmers' Fair CSR Event Page
app.get('/admin/pages/farmers-fair', async (req, res) => {
    try {
        const data = await getPageContent('farmersFair');
        res.render('admin-page-farmers-fair', {
            title: 'Admin — Customize Farmers’ Fair CSR',
            data,
            activeTab: 'page-farmers-fair'
        });
    } catch (err) {
        console.error('Admin Farmers Fair Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/farmers-fair', upload.any(), async (req, res) => {
    try {
        const fileMap = mapUploadedFiles(req.files);
        const existingData = await getPageContent('farmersFair');

        const sections = [];
        for (let i = 0; i < 4; i++) {
            if (req.body[`secTitle_${i}`] || req.body[`secP1_${i}`]) {
                sections.push({
                    num: `0${i + 1}`,
                    title: req.body[`secTitle_${i}`] || '',
                    p1: req.body[`secP1_${i}`] || '',
                    p2: req.body[`secP2_${i}`] || ''
                });
            }
        }

        const updated = {
            ...existingData,
            badge: req.body.badge !== undefined ? req.body.badge : existingData.badge,
            titlePart1: req.body.titlePart1 !== undefined ? req.body.titlePart1 : existingData.titlePart1,
            titlePart2: req.body.titlePart2 !== undefined ? req.body.titlePart2 : existingData.titlePart2,
            subtitle: req.body.subtitle !== undefined ? req.body.subtitle : existingData.subtitle,
            mainImage: fileMap['mainImage'] || existingData.mainImage,
            mainImageCaption: req.body.mainImageCaption !== undefined ? req.body.mainImageCaption : existingData.mainImageCaption,
            factsheet: {
                eventName: req.body.factEventName || (existingData.factsheet && existingData.factsheet.eventName) || '',
                region: req.body.factRegion || (existingData.factsheet && existingData.factsheet.region) || '',
                sponsoredBy: req.body.factSponsoredBy || (existingData.factsheet && existingData.factsheet.sponsoredBy) || '',
                keyFocus: req.body.factKeyFocus || (existingData.factsheet && existingData.factsheet.keyFocus) || '',
                qualityBadge: req.body.factQualityBadge || (existingData.factsheet && existingData.factsheet.qualityBadge) || ''
            },
            sections: sections.length > 0 ? sections : existingData.sections
        };

        await savePageContent('farmersFair', updated);
        res.redirect('/admin/pages/farmers-fair');
    } catch (err) {
        console.error('Save Farmers Fair Content Error:', err);
        res.redirect('/admin/pages/farmers-fair');
    }
});

// Admin: Customize Vendor Empanelment Page
app.get('/admin/pages/vendor-empanelment', async (req, res) => {
    try {
        const data = await getPageContent('vendorEmpanelment');
        res.render('admin-page-vendor-empanelment', {
            title: 'Admin — Customize Vendor Empanelment',
            data,
            activeTab: 'page-vendor-empanelment'
        });
    } catch (err) {
        console.error('Admin Vendor Empanelment Customizer Error:', err);
        res.redirect('/admin/pages');
    }
});

app.post('/admin/pages/vendor-empanelment', upload.none(), async (req, res) => {
    try {
        const existingData = await getPageContent('vendorEmpanelment');

        let approvedDepartments = existingData.approvedDepartments || [];
        if (req.body.approvedDepartments) {
            approvedDepartments = req.body.approvedDepartments.split('\n').map(d => d.trim()).filter(Boolean);
        }

        const updated = {
            ...existingData,
            headerTitle: req.body.headerTitle !== undefined ? req.body.headerTitle : existingData.headerTitle,
            headerSubtitle: req.body.headerSubtitle !== undefined ? req.body.headerSubtitle : existingData.headerSubtitle,
            empanelmentTitle: req.body.empanelmentTitle !== undefined ? req.body.empanelmentTitle : existingData.empanelmentTitle,
            empanelmentIntro: req.body.empanelmentIntro !== undefined ? req.body.empanelmentIntro : existingData.empanelmentIntro,
            approvedDepartments,
            formTitle: req.body.formTitle !== undefined ? req.body.formTitle : existingData.formTitle,
            formRecipientEmail: req.body.formRecipientEmail !== undefined ? req.body.formRecipientEmail : existingData.formRecipientEmail
        };

        await savePageContent('vendorEmpanelment', updated);
        res.redirect('/admin/pages/vendor-empanelment');
    } catch (err) {
        console.error('Save Vendor Empanelment Content Error:', err);
        res.redirect('/admin/pages/vendor-empanelment');
    }
});

// Route for the Farmers' Fair CSR Event page
app.get('/farmers-fair', async (req, res) => {
    try {
        const pageData = await getPageContent('farmersFair');
        res.render('farmers-fair', { title: 'Farmers’ Fair & Agricultural Exhibition Sponsorship — Solanki Pipes', pageData });
    } catch (err) {
        console.error('Farmers Fair Error:', err);
        res.render('farmers-fair', { title: 'Farmers’ Fair & Agricultural Exhibition Sponsorship — Solanki Pipes', pageData: getDefaultPageData('farmersFair') });
    }
});

// Route for the contact page
app.get('/contact', async (req, res) => {
    try {
        const pageData = await getPageContent('contact');
        res.render('contact', { title: 'Contact Solanki Industries', pageData });
    } catch (err) {
        console.error('Contact Page Error:', err);
        res.render('contact', { title: 'Contact Solanki Industries', pageData: getDefaultPageData('contact') });
    }
});

// Route for vendor empanelment page
app.get('/vendor-empanelment', async (req, res) => {
    try {
        const pageData = await getPageContent('vendorEmpanelment');
        res.render('vendor-empanelment', { title: 'Vendor Empanelment — Solanki Industries', pageData });
    } catch (err) {
        console.error('Vendor Empanelment Error:', err);
        res.render('vendor-empanelment', { title: 'Vendor Empanelment — Solanki Industries', pageData: getDefaultPageData('vendorEmpanelment') });
    }
});

app.get('/privacy', (req, res) => {
    res.render('privacy', { title: 'Privacy Policy — Solanki Industries' });
});

app.get('/terms', (req, res) => {
    res.render('terms', { title: 'Terms & Conditions — Solanki Industries' });
});

// ==========================================
// PROMOTIONAL POPUP MODAL ROUTES (API & ADMIN)
// ==========================================

// Public API: Get current popup configuration
app.get('/api/popup', async (req, res) => {
    try {
        const popup = await getPopupSettings();
        res.json({ success: true, popup });
    } catch (err) {
        console.error('API /api/popup error:', err);
        res.status(500).json({ success: false, message: err.message, popup: getDefaultPopupSettings() });
    }
});

// Admin Web: Show popup management console
app.get('/admin/popup', async (req, res) => {
    try {
        const popup = await getPopupSettings();
        res.render('admin-popup', {
            title: 'Admin — Promotional Popup',
            popup,
            activeTab: 'popup',
            query: req.query || {}
        });
    } catch (err) {
        console.error('Admin popup load error:', err);
        res.render('admin-popup', {
            title: 'Admin — Promotional Popup',
            popup: getDefaultPopupSettings(),
            activeTab: 'popup',
            query: { error: err.message }
        });
    }
});

// Admin Web: Handle form submit to save popup settings
app.post('/admin/popup', uploadPopupMedia, async (req, res) => {
    try {
        const current = await getPopupSettings();
        const body = req.body || {};

        let resolvedImage = current.imageUrl || current.image || '/images/sp_img1.jpeg';
        if (req.files && (req.files.popupImage || req.files.image)) {
            const uploadedFile = (req.files.popupImage && req.files.popupImage[0]) || (req.files.image && req.files.image[0]);
            if (uploadedFile && uploadedFile.filename) {
                resolvedImage = `/uploads/${uploadedFile.filename}`;
            }
        } else if (body.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.trim() !== '') {
            resolvedImage = body.imageUrl.trim();
        } else if (body.image && typeof body.image === 'string' && body.image.trim() !== '') {
            resolvedImage = body.image.trim();
        }

        const btnText = (body.buttonText || body.ctaText || 'Explore Products').trim();
        const btnLink = (body.buttonLink || body.ctaLink || '/hdpe').trim();
        const btnColor = (body.buttonColor || body.ctaColor || 'emerald').trim();
        const freq = ['every_refresh', 'once_session', 'once_day'].includes(body.frequency || body.displayFrequency) ? (body.frequency || body.displayFrequency) : 'every_refresh';

        const updated = {
            enabled: body.enabled === 'true' || body.enabled === 'on' || body.enabled === true || body.enabled === '1',
            badgeText: (body.badgeText || 'Special Offer').trim(),
            badgeColor: body.badgeColor || 'rose',
            title: (body.title || 'High-Performance HDPE Pipes').trim(),
            titleHighlight: (body.titleHighlight || 'at Factory Best Prices!').trim(),
            description: (body.description || '').trim(),
            buttonText: btnText,
            ctaText: btnText,
            buttonLink: btnLink,
            ctaLink: btnLink,
            buttonColor: btnColor,
            ctaColor: btnColor,
            ctaTarget: body.ctaTarget || current.ctaTarget || '_self',
            imageUrl: resolvedImage,
            image: resolvedImage,
            imageAlt: (body.imageAlt || 'Special Promotion').trim(),
            delaySeconds: !isNaN(parseFloat(body.delaySeconds)) ? parseFloat(body.delaySeconds) : 0.5,
            frequency: freq,
            displayFrequency: freq,
            showCloseButton: body.showCloseButton !== 'false' && body.showCloseButton !== false,
            backdropBlur: body.backdropBlur !== 'false' && body.backdropBlur !== false
        };

        await savePopupSettings(updated);
        res.redirect('/admin/popup?saved=true');
    } catch (err) {
        console.error('Error saving popup from admin form:', err);
        res.redirect('/admin/popup?error=' + encodeURIComponent(err.message));
    }
});

// API: Save popup settings via JSON or multipart
app.post('/api/popup', uploadPopupMedia, async (req, res) => {
    try {
        const current = await getPopupSettings();
        const body = req.body || {};

        let resolvedImage = current.imageUrl || current.image || '/images/sp_img1.jpeg';
        if (req.files && (req.files.popupImage || req.files.image)) {
            const uploadedFile = (req.files.popupImage && req.files.popupImage[0]) || (req.files.image && req.files.image[0]);
            if (uploadedFile && uploadedFile.filename) {
                resolvedImage = `/uploads/${uploadedFile.filename}`;
            }
        } else if (body.imageUrl && typeof body.imageUrl === 'string' && body.imageUrl.trim() !== '') {
            resolvedImage = body.imageUrl.trim();
        } else if (body.image && typeof body.image === 'string' && body.image.trim() !== '') {
            resolvedImage = body.image.trim();
        }

        const btnText = (body.buttonText || body.ctaText || current.buttonText || current.ctaText || 'Explore Products').trim();
        const btnLink = (body.buttonLink || body.ctaLink || current.buttonLink || current.ctaLink || '/hdpe').trim();
        const btnColor = (body.buttonColor || body.ctaColor || current.buttonColor || current.ctaColor || 'emerald').trim();
        const rawFreq = body.frequency || body.displayFrequency || current.frequency || current.displayFrequency;
        const freq = ['every_refresh', 'once_session', 'once_day'].includes(rawFreq) ? rawFreq : 'every_refresh';

        const updated = {
            enabled: body.enabled !== undefined ? (body.enabled === 'true' || body.enabled === 'on' || body.enabled === true || body.enabled === '1') : current.enabled,
            badgeText: (body.badgeText || current.badgeText || 'Special Offer').trim(),
            badgeColor: body.badgeColor || current.badgeColor || 'rose',
            title: (body.title || current.title || '').trim(),
            titleHighlight: (body.titleHighlight || current.titleHighlight || '').trim(),
            description: (body.description || current.description || '').trim(),
            buttonText: btnText,
            ctaText: btnText,
            buttonLink: btnLink,
            ctaLink: btnLink,
            buttonColor: btnColor,
            ctaColor: btnColor,
            ctaTarget: body.ctaTarget || current.ctaTarget || '_self',
            imageUrl: resolvedImage,
            image: resolvedImage,
            imageAlt: (body.imageAlt || current.imageAlt || 'Special Promotion').trim(),
            delaySeconds: body.delaySeconds !== undefined && !isNaN(parseFloat(body.delaySeconds)) ? parseFloat(body.delaySeconds) : current.delaySeconds,
            frequency: freq,
            displayFrequency: freq,
            showCloseButton: body.showCloseButton !== undefined ? (body.showCloseButton === 'true' || body.showCloseButton === true) : (current.showCloseButton !== false),
            backdropBlur: body.backdropBlur !== undefined ? (body.backdropBlur === 'true' || body.backdropBlur === true) : (current.backdropBlur !== false)
        };

        const result = await savePopupSettings(updated);
        res.json({ success: true, message: 'Popup settings updated successfully', popup: result });
    } catch (err) {
        console.error('API /api/popup POST error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Quick toggle status: PATCH or POST /api/popup/status
const handlePopupStatusToggle = async (req, res) => {
    try {
        const current = await getPopupSettings();
        const enabled = req.body && req.body.enabled !== undefined ? !!req.body.enabled : !current.enabled;
        const result = await savePopupSettings({ ...current, enabled });
        res.json({ success: true, enabled: result.enabled, popup: result });
    } catch (err) {
        console.error('API /api/popup/status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

app.patch('/api/popup/status', handlePopupStatusToggle);
app.post('/api/popup/status', handlePopupStatusToggle);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

module.exports = {
    app,
    getFounderMessage,
    getCertificationsData,
    getProjectsData,
    getSiteSettings,
    getPageContent,
    getLeadershipData,
    saveLeadershipData,
    getAllLeaders,
    saveLeaderItem,
    removeLeaderItem,
    saveFounderMessage,
    savePageContent,
    saveSiteSettings,
    getPopupSettings,
    savePopupSettings
};