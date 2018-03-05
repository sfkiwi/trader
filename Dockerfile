FROM mhart/alpine-node:latest

# RUN mkdir /app
WORKDIR /app

COPY package.json yarn.lock ./
RUN apk add --no-cache git mercurial
RUN which git
RUN yarn install --production

FROM mhart/alpine-node:latest
WORKDIR /app
COPY --from=0 /app .
COPY . .
RUN npm install -g typescript
RUN tsc

FROM mhart/alpine-node:latest
WORKDIR /app
COPY --from=1 /app .
CMD ["node"]

