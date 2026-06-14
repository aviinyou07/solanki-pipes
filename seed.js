const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { mongoose, Project, Admin } = require('./db');

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
