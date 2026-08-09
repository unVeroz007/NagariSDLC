# Stage 1: Build React Application
FROM node:20-alpine AS build

WORKDIR /app

# Build-time environment variables for Vite
ARG VITE_API_URL
ARG VITE_API_MODE
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_MODE=${VITE_API_MODE}

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx Enterprise Server
FROM nginx:alpine

# Copy built dist files to Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
