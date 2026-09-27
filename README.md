# speedtest-pro
speedtest-pro



## steps to start the application locally using Docker 
-  `docker build -t speedtest-app .`
- `docker run --rm -p 3000:3000 -v ${PWD}:/app -w /app node:24-slim node server.js`
