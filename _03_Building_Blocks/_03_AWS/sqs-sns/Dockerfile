FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=9324 DATA_DIR=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 9324
USER node
CMD ["node", "server.js"]
