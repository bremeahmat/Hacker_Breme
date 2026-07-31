FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/bremeahmat/Hacker_Breme/app

WORKDIR /app

RUN npm install

EXPOSE 8000

CMD ["npm", "start"]

