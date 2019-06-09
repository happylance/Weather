FROM node:12
WORKDIR /usr/src/app
COPY package*.json ./
COPY .forecast_io /root/
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]