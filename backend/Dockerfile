FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY src ./src
COPY db ./db
COPY scripts ./scripts
<<<<<<< Updated upstream
EXPOSE 3000
=======
EXPOSE 4000
>>>>>>> Stashed changes
CMD ["npm", "run", "start"]
