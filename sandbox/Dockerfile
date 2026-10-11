# Sandbox image used to compile, run and debug user-submitted C programs.
# The container is started by the server with no network, a read-only root
# filesystem, dropped capabilities and strict resource limits (see
# apps/server/src/sandbox/docker.ts).
FROM ubuntu:24.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libc6-dev gdb \
 && rm -rf /var/lib/apt/lists/*

COPY avrun.c avrt.c /opt/av/src/
RUN gcc -O2 -Wall -Wextra -o /opt/av/avrun /opt/av/src/avrun.c \
 && gcc -O2 -Wall -Wextra -c -o /opt/av/avrt.o /opt/av/src/avrt.c \
 && gcc -O1 -Wall -Wextra -c -o /opt/av/avrt_debug.o /opt/av/src/avrt.c -DAV_ALLOC_TRACKING \
 && chmod -R a+rX /opt/av

WORKDIR /box
USER 65534:65534
