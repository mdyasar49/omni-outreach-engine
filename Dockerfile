FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y python3 python3-pip python3-dnspython dnsutils && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server package.json and install
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy python engine requirements and install
COPY python_engine/requirements.txt ./python_engine/
RUN pip install --no-cache-dir --break-system-packages -r python_engine/requirements.txt || true

# Copy source code
COPY . .

EXPOSE 4000

CMD ["node", "server/server.js"]
