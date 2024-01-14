# Use the official Node.js 20 image as a parent image
FROM node:20

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available) to the container
COPY package*.json ./

# Install dependencies in the container
RUN npm install

# Copy the rest of the application source code from the current directory to the container
COPY . .

# Define the command to run the app using the start script from package.json
CMD [ "npm", "start" ]