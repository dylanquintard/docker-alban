FROM node:22-bookworm-slim AS build

WORKDIR /app/pizzeria-admin-web

COPY pizzeria-admin-web/package*.json ./
RUN npm install

COPY pizzeria-admin-web ./
COPY pizzeria-web-service-front ../pizzeria-web-service-front

ARG VITE_API_BASE_URL
ARG VITE_SITE_URL
ARG VITE_PUBLIC_SITE_URL

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SITE_URL=${VITE_SITE_URL}
ENV VITE_PUBLIC_SITE_URL=${VITE_PUBLIC_SITE_URL}

RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY pizzeria-admin-web/package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/pizzeria-admin-web/build ./build
COPY --from=build /app/pizzeria-admin-web/server.js ./server.js

EXPOSE 4174

CMD ["npm", "run", "start"]
