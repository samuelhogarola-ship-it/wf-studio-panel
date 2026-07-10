FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN rm -f .env .env.* && npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
