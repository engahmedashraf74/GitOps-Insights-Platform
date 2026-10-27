FROM node:22.23.4-alpine3.24

WORKDIR /app
COPY agent.mjs /app/agent.mjs
RUN adduser -D -u 65532 -H -s /sbin/nologin connector
USER connector

CMD ["node", "agent.mjs"]
