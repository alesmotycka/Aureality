# Self-contained image (alternative to the volume-based docker-compose.yml).
FROM node:22-alpine
WORKDIR /app
COPY server/ server/
COPY web/ web/
COPY landing/ landing/
EXPOSE 8080
CMD ["node", "server/server.js"]
