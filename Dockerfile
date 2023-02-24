FROM node:18-alpine3.17

USER root

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN chmod -R 777 /usr/src/app


COPY package.json .



RUN yarn install

COPY . .

RUN yarn run build


EXPOSE 3000
CMD [ "yarn", "run", "start:prod" ]