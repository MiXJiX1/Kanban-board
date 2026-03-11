import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Testing database connection...');
    try {
        // Try to count users to see if we can connect and query
        const userCount = await prisma.user.count();
        console.log('✅ Connection successful!');
        console.log(`Found ${userCount} users in the database.`);
    } catch (error) {
        console.error('❌ Connection failed!');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
