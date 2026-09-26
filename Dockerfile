# Use the slim Node image for a small footprint
FROM node:24-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install (though we have zero  dependencies, this is best practice)
COPY package*.json ./

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run the application
CMD [ "node", "server.js" ]
