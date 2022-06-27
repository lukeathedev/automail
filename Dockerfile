# Installing
FROM node:16-alpine as build

WORKDIR /usr/src/automail

COPY package*.json ./
COPY tsconfig.json ./

COPY src ./src

RUN npm install
RUN npm run build

# Running
FROM node:16-alpine

WORKDIR /usr/bin/automail
VOLUME ./downloads

COPY package*.json ./
COPY .env .

RUN npm ci --omit=dev
COPY --from=build /usr/src/automail/build ./

CMD ["node", "index.js"]