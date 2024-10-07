FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=development



RUN apt-get update && apt-get install -y curl git && \
  apt-get clean && apt-get autoclean && apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm && npm cache clean --force

RUN mkdir -p $PNPM_HOME && \
  pnpm config set store-dir $PNPM_HOME


USER node

WORKDIR /home/node/app

COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY . .

CMD ["tail", "-f", "/dev/null"]
