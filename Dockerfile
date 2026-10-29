FROM node:22-slim
WORKDIR /app
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/
RUN npm --prefix backend ci && npm --prefix frontend ci
COPY . .
RUN npm --prefix frontend run build
ENV DATA_DIR=/data PORT=8080 NODE_NO_WARNINGS=1
VOLUME /data
EXPOSE 8080
CMD ["backend/node_modules/.bin/tsx", "backend/src/server.ts"]
