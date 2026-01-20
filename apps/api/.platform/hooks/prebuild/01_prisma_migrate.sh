#!/bin/bash
set -e

echo "Running Prisma migrations..."
cd /var/app/staging
npm install prisma --no-save
npx prisma migrate deploy
echo "Prisma migrations completed"
