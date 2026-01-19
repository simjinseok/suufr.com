#!/bin/bash
cd /var/app/staging
npx prisma migrate deploy
