#
# Copyright IBM Corp. 2024
#
FROM registry.access.redhat.com/ubi8/nodejs-18-minimal

USER root
RUN microdnf update -y && microdnf -y clean all && rm -rf /var/cache/yum/*
USER 1001

COPY --chown=1001 . .

RUN npm ci --production && npm cache clean --force

ENV NODE_ENV="production"
ENV LOG_LEVEL="debug"

EXPOSE 3000

CMD [ "npm", "start" ]
