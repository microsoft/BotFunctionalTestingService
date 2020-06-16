FROM node:10.15-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . /app

ENV SECRETS="{\"ctm-bot-covid19-wadnft\": \"27VcFzT8L68.82xE6r8TC1As951o-4fDcSyHgy0_PPxTIgn_JS9Bj3o\",\"covidctm-shnwb3c\": \"1iUqAU_sb0c.OC-b1JC1HXcYT-zWDZNaXpzzBQDANze2bagvkmYm6xw\",\"mosab-eefpn4m\":\"M7yPuFydlTM.qdnDg9_qd6v3_46jnkB7MPPIU0hnuv27W-zZQjHiLLI\"}"

EXPOSE 3000

CMD [ "node", "app.js" ]