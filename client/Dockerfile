# Build stage
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# If we have a custom nginx config, we can copy it here in the Dockerfile 
# or mount it in docker-compose. Mount is often more flexible.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
