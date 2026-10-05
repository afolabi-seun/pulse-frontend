FROM node:20-alpine AS build
WORKDIR /app

# Optional: absolute URL of the backend API (e.g. https://pulse-svc.example.com).
# Leave unset when the frontend and API are served from the same origin via nginx proxy.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy only package.json (no lock file) so npm installs platform-native binaries correctly
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
