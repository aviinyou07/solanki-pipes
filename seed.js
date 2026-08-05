const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { mongoose, Project, Admin, Certification, Product } = require('./db');

async function seed() {
    try {
        // Wait for mongoose connection
        if (mongoose.connection.readyState !== 1) {
            await new Promise((resolve) => mongoose.connection.once('open', resolve));
        }

        console.log('Seeding projects...');
        const projectsFilePath = path.join(__dirname, 'data', 'projects.json');
        if (!fs.existsSync(projectsFilePath)) {
            throw new Error(`Projects file not found at ${projectsFilePath}`);
        }

        const rawData = fs.readFileSync(projectsFilePath, 'utf8');
        const projectsData = JSON.parse(rawData);

        // Map 'id' to '_id' for Mongoose project models
        const formattedProjects = projectsData.map(proj => {
            const formatted = { ...proj, _id: proj.id };
            delete formatted.id;
            
            // Map createdDate string to Date object
            if (formatted.createdDate) {
                formatted.createdDate = new Date(formatted.createdDate);
            }
            return formatted;
        });

        // Clear existing projects and insert new ones
        await Project.deleteMany({});
        await Project.insertMany(formattedProjects);
        console.log(`Successfully seeded ${formattedProjects.length} projects.`);

        // Clear and seed admin accounts
        console.log('Seeding admin accounts...');
        const hritikPasswordHash = await bcrypt.hash('hritik@123', 10);
        const adminPasswordHash = await bcrypt.hash('admin@123', 10);
        const admins = [
            {
                username: 'admin',
                password: adminPasswordHash
            },
            {
                username: 'hritik',
                password: hritikPasswordHash
            },
            {
                username: 'Hritik',
                password: hritikPasswordHash
            }
        ];
        await Admin.deleteMany({});
        await Admin.insertMany(admins);
        console.log(`Successfully seeded ${admins.length} admin accounts.`);

        // Clear and seed certifications
        console.log('Seeding certifications...');
        const certsFilePath = path.join(__dirname, 'data', 'certifications.json');
        if (fs.existsSync(certsFilePath)) {
            const rawCerts = fs.readFileSync(certsFilePath, 'utf8');
            const certsData = JSON.parse(rawCerts);
            await Certification.deleteMany({});
            await Certification.insertMany(certsData);
            console.log(`Successfully seeded ${certsData.length} certifications.`);
        } else {
            console.log('No certifications.json found to seed.');
        }

        // Clear and seed products
        console.log('Seeding products...');
        const productsFilePath = path.join(__dirname, 'data', 'products.json');
        if (fs.existsSync(productsFilePath)) {
            const rawProducts = fs.readFileSync(productsFilePath, 'utf8');
            const productsData = JSON.parse(rawProducts);
            const formattedProducts = productsData.map(p => {
                const formatted = { ...p, _id: p.id };
                delete formatted.id;
                return formatted;
            });
            await Product.deleteMany({});
            await Product.insertMany(formattedProducts);
            console.log(`Successfully seeded ${formattedProducts.length} products.`);
        } else {
            console.log('No products.json found to seed.');
        }

        console.log('Database seeding finished successfully!');
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        console.log('Database connection closed.');
    }
}

seed();
