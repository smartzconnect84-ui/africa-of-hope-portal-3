FROM node:26-alpine AS build
RUN apk upgrade --no-cache
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
FROM python:3-alpine
# The date keys the build cache so this layer installs today's OS fixes; AppJet keeps it current on deploy.
RUN echo "os-refresh 2026-11-13" && apk upgrade --no-cache
WORKDIR /app
COPY --from=build /app/dist ./
ENV PORT=3000
EXPOSE 3000
CMD python3 -m http.server "$PORT" --bind 0.0.0.0
