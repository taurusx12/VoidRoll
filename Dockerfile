FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
