import { PrismaClient } from '../prisma/generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.POSTGRES_PRISMA_URL });
const adapter = new PrismaPg(pool);
const prismaClientSingletone = () => {
  return new PrismaClient({ adapter });
};

// const globalForPrisma = global;
const prisma = prismaClientSingletone();
export default prisma;
