#!/bin/bash
set -e

echo "Running Prisma migrations..."
cd /var/app/staging
npx prisma migrate deploy
echo "Prisma migrations completed"
