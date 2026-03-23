FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_REALTIME_STREAM_URL
ARG VITE_SW_VERSION

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_REALTIME_STREAM_URL=${VITE_REALTIME_STREAM_URL}
ENV VITE_SW_VERSION=${VITE_SW_VERSION}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
