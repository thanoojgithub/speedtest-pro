# SpeedTest Pro

Enterprise-grade, zero-dependency browser and network benchmark application. Designed with modern aesthetics inspired by Fast.com (pure white, pure black, and pure red accents) with a strict zero-scroll responsive viewport (`100dvh`), standards-based Wi-Fi throughput calculations, real-time latency diagnostics, and strict client privacy (zero data retention).

---

---

## ⚙️ Configuration Options

The application is configurable via standard environment variables:

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | The local port the HTTP server binds to. |
| `NODE_ENV` | `production` | Runtime mode (`development` or `production`). |

To configure a custom port (e.g. `8080`):
- **Docker**: `-e PORT=8080 -p 8080:8080`
- **Node.js**: `PORT=8080 node server.js` (macOS/Linux) or `$env:PORT=8080; node server.js` (PowerShell)

---

## 🚀 Running & Stopping the Application

### Option 1: Using Docker (Recommended)

No local Node.js runtime is required.

#### 1. Start the Container:
- **Windows (PowerShell)**:
  ```powershell
  docker run -d --name speedtest-server -p 3000:3000 -v ${PWD}:/app -w /app node:24-slim node server.js
  ```
- **macOS / Linux (Bash)**:
  ```bash
  docker run -d --name speedtest-server -p 3000:3000 -v "$(pwd)":/app -w /app node:24-slim node server.js
  ```

#### 2. Restart the Container:
```bash
docker restart speedtest-server
```

#### 3. Stop the Container:
```bash
docker stop speedtest-server
```

#### 4. Remove the Container:
```bash
docker rm speedtest-server
```

---

### Option 2: Using Local Node.js

#### 1. Start the Server:
```bash
node server.js
```

#### 2. Stop the Server:
Press `Ctrl + C` in your terminal window.

---

## 🔍 Checking Logs & Debugging

### 1. Server-Side Logs & Diagnostics

- **Stream Live Docker Logs**:
  ```bash
  docker logs -f speedtest-server
  ```
- **Inspect Last 50 Log Lines**:
  ```bash
  docker logs --tail 50 speedtest-server
  ```
- **Verify Server Health & JSON Metadata Endpoint**:
  ```bash
  curl -i http://localhost:3000/server-info
  ```
  Expected output includes node identity, ISP, AS number, and architecture:
  ```json
  {"isp":"...","org":"...","city":"...","country":"...","as":"...","ip":"...","nodeName":"Edge Node - ..."}
  ```

- **Verify Ping / Health Endpoint**:
  ```bash
  curl -i http://localhost:3000/ping
  ```
  Expected response: `HTTP/200 OK` with body `pong` and `Timing-Allow-Origin: *`.

### 2. Client-Side Browser Debugging

1. Open DevTools in your browser:
   - **Windows / Linux**: Press `F12` or `Ctrl + Shift + I`
   - **macOS**: Press `Cmd + Option + I`
2. **Console Tab**:
   - Check for real-time connection status messages, sliding-window throughput recalculations, or test cancellation notifications.
3. **Network Tab**:
   - Filter by `Fetch/XHR`.
   - Observe parallel multi-stream chunks for download (`speed.cloudflare.com/__down` or `/proxy-download`).
   - Observe parallel chunk uploads (`speed.cloudflare.com/__up` or `/proxy-upload`).
   - Inspect response headers for `Timing-Allow-Origin: *` and `Cache-Control: no-store`.
4. **Performance Tab**:
   - Run a profile during a test to inspect CPU utilization, WebGL GPU context, and real-time garbage collection behavior.

---

## 🌐 Opening the Application

1. Open your web browser (Chrome, Edge, Firefox, Safari, or any mobile browser).
2. Navigate to:
   ```
   http://localhost:3000
   ```
3. The interface will load fitted to your native browser viewport with zero scrollbars on any screen size (mobile, tablet, laptop, desktop, or 4K monitor).

---

## 🧭 How to Navigate the Application

1. **Initial Page View**:
   - Both the **Download Performance** and **Upload Performance** cards start faded out to focus your attention on the primary action.
   - Connected edge server identity and approximate location are displayed in the header badge.
2. **Starting the Test**:
   - Click the red **`START TEST`** button.
   - The **Download Performance** card instantly activates while the Upload card remains faded.
   - Network edge latency, jitter, DNS lookup, and TCP handshake are probed first.
3. **Download Phase**:
   - Multi-stream parallel connections fetch real-time payload chunks over your Wi-Fi interface.
   - A 2.5-second sliding window dynamically tracks current bitrate in **Mbps** (discarding initial TCP slow-start).
   - Loaded latency and data received are monitored live.
4. **Upload Phase**:
   - Upon download completion, the **Upload Performance** card automatically activates and begins testing.
   - Dual parallel uploads test upstream Wi-Fi throughput.
   - Units dynamically adjust between **Mbps** and **Kbps** for asymmetric residential connections.
5. **Viewing Diagnostics**:
   - Click the **`Show Technical Details`** button below the test controls to reveal deep-dive network, ISP, and hardware telemetry.
6. **Interrupting a Test**:
   - While a test is running, clicking **`STOP TEST`** cleanly aborts all active network streams, releases memory buffers, and purges browser cache.

---

## 📊 Details Fetched and Displayed to the User

### 1. Primary Speed & Throughput
| Metric | Description |
| :--- | :--- |
| **Download Speed** | Real-time sustained download bitrate calculated over a steady-state sliding window (`Mbps`). |
| **Upload Speed** | Real-time sustained upload bitrate with automatic unit scaling (`Mbps` or `Kbps`). |
| **Loaded Download Ping** | Latency measured while the network link is saturated with download traffic (`ms`). |
| **Loaded Upload Ping** | Latency measured while the network link is actively uploading (`ms`). |
| **Connection Stability** | Real-time variance indicator (`High` or `Stable`) based on bitrate consistency. |
| **Data Transferred** | Exact volume of bytes received and transmitted during the test session (`MB`). |

### 2. Network Health & Latency
| Metric | Description |
| :--- | :--- |
| **Unloaded Ping** | Edge round-trip time (RTT) measured before network saturation, filtered for outliers (`ms`). |
| **Jitter (Variance)** | Statistical variation in packet arrival delay across consecutive network probes (`ms`). |
| **DNS Lookup** | Time taken by the browser/system resolver to translate the domain into an IP address (`ms`). |
| **TCP Handshake** | Duration of the SYN / SYN-ACK / ACK connection establishment with the edge server (`ms`). |

### 3. ISP & Edge Server Details
| Metric | Description |
| :--- | :--- |
| **ISP Provider** | Name of the active Internet Service Provider or carrier. |
| **Organization** | Autonomous system organization managing the network route. |
| **ASN / IP** | Autonomous System Number (ASN) and public IP identifier (auto-masked after test for privacy). |
| **Data Center** | Physical location (City, Country) of the responding edge node. |

### 4. System & Hardware Telemetry
| Metric | Description |
| :--- | :--- |
| **Device / OS** | Client platform detected (Windows, MacOS, Linux, Android, iOS). |
| **Browser Engine** | Active browser brand and user agent family. |
| **Network Type** | Connection capability profile (5G / Fiber Optic, 4G+ / LTE-Advanced, 3G, etc.). |
| **CPU / RAM** | Logical hardware concurrency core count and available device memory estimate. |
| **GPU Model** | WebGL graphics rendering engine unmasked from client hardware. |
| **Browser Cache** | Quota of local browser cache, automatically purged at the end of each benchmark session. |

---

## 🌐 Cross-Browser & Cross-OS Compatibility Matrix

The application is thoroughly optimized and verified for:

| Category | Supported Environments |
| :--- | :--- |
| **Operating Systems** | Windows 10/11, macOS (Intel & Apple Silicon), Linux Distros (Ubuntu, Debian, Fedora, Arch, RHEL/CentOS), ChromeOS, Android, and iOS / iPadOS. |
| **Browser Engines** | Blink (Google Chrome, Microsoft Edge, Brave, Opera), Gecko (Mozilla Firefox), WebKit (Apple Safari, iOS Safari). |
| **Device Form Factors** | Mobile smartphones (< 420px), Tablets (768px portrait/landscape), Laptops (1080p, 1440p), Desktop monitors, and Ultra-Wide / 4K displays. |
| **Viewport Fitting** | Native `100dvh` CSS container with `clamp()` typography and fluid flex grid — **zero scrollbars** on all form factors. |

---

## ⚖️ 100% Open & Standard Measurement Architecture (Zero Private APIs)

SpeedTest Pro uses an open measurement model adhering to web standards:

1. **Multi-Stream Wi-Fi Saturation**:
   - Uses native `fetch()` Streams API and `XMLHttpRequest` upload blobs to measure true TCP throughput.
   - Computes throughput over sliding windows (2.5s download, 2.0s upload) discarding initial slow-start TCP ramp-up.
2. **Open CDN Edge Endpoints**:
   - Uses public, standard edge endpoints (`https://speed.cloudflare.com/__down` and `__up`) with zero private tokens, cookies, or vendor credentials.
   - Built-in Node.js proxy fallback routes (`/proxy-download` and `/proxy-upload`) to bypass restrictive corporate proxy blocks or mixed-content policies.
3. **W3C Performance Resource Timing API**:
   - Measures genuine edge ping, statistical jitter (mean absolute deviation), DNS lookup time (`domainLookupEnd - domainLookupStart`), and TCP handshake time (`connectEnd - connectStart`).
4. **Zero Data Retention & Privacy**:
   - Never logs or stores client speed data on the server.
   - Sanitizes client cookies, local/session storage, cache storage, and performance logs in the `finally` block on completion or interrupt.
