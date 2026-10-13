FROM node:20-alpine

WORKDIR /app
COPY package.json ./
COPY src ./src
COPY web ./web

ENV PORT=3000
EXPOSE 3000

# 默认启动网页版；命令行用法：docker run --rm -v $PWD/cookies:/cookies <image> node src/send.js --cookie-file /cookies/my.json --peer 123 --text hi
CMD ["node", "web/server.mjs"]
