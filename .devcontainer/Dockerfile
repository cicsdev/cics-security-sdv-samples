#
# Copyright IBM Corp. 2024
#
FROM mcr.microsoft.com/devcontainers/base:jammy

RUN apt update

ENV LOG_LEVEL="trace"

EXPOSE 3000
EXPOSE 3001

COPY initialise_dev_container.sh /post_script/initialise_dev_container.sh

RUN mkdir -p /workspaces; \
    chmod 755 /post_script/initialise_dev_container.sh

WORKDIR /workspaces
