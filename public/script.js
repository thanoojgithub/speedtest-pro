const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status');
const mainDl = document.getElementById('main-dl');
const mainUl = document.getElementById('main-ul');
const techSection = document.getElementById('technical-section');

const ui = {
    dlPing: document.getElementById('dl-ping'),
    dlStability: document.getElementById('dl-stability'),
    dlData: document.getElementById('dl-data'),
    ulPing: document.getElementById('ul-ping'),
    ulStability: document.getElementById('ul-stability'),
    ulData: document.getElementById('ul-data'),
    ping: document.getElementById('ping'),
    jitter: document.getElementById('jitter'),
    dnsPing: document.getElementById('dns-ping'),
    tcpPing: document.getElementById('tcp-ping'),
    srvIsp: document.getElementById('srv-isp'),
    srvOrg: document.getElementById('srv-org'),
    srvIp: document.getElementById('srv-ip'),
    srvLoc: document.getElementById('srv-loc'),
    devOs: document.getElementById('dev-os'),
    devBrowser: document.getElementById('dev-browser'),
    devConn: document.getElementById('dev-conn'),
    devHw: document.getElementById('dev-hw'),
    devGpu: document.getElementById('dev-gpu'),
    devStorage: document.getElementById('dev-storage'),
};

function getCleanGPU() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return "Generic GPU";
        let renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const cleaned = renderer.replace(/ANGLE\s*\(|\)\s*Direct3D.*/g, '').replace(/OpenGL\s*rendering\s*engine/, '').trim();
        return cleaned.includes(',') ? cleaned.split(',')[1].trim() : cleaned;
    } catch (e) { return "Unknown GPU"; }
}

function getNetworkAccuracy(measuredSpeedMbps) {
    const conn = navigator.connection || {};
    const effectiveType = (conn.effectiveType || "unknown").toUpperCase();
    if (measuredSpeedMbps === 0) return `Pending (${effectiveType})`;
    if (measuredSpeedMbps > 500) return "5G / Fiber Optic";
    if (measuredSpeedMbps > 100) return "4G+ / LTE-Advanced";
    if (measuredSpeedMbps > 20) return `4G (${effectiveType})`;
    if (measuredSpeedMbps > 2) return `3G (${effectiveType})`;
    return `2G/Slow (${effectiveType})`;
}

async function fetchLocalSystemInfo() {
    const ua = navigator.userAgent;
    let os = ua.indexOf("Win") != -1 ? "Windows" : (ua.indexOf("Mac") != -1 ? "MacOS" : "Linux/Android");
    ui.devOs.innerText = os;
    ui.devBrowser.innerText = navigator.userAgentData ? navigator.userAgentData.brands[0].brand : "Standard Browser";
    const conn = navigator.connection || {};
    ui.devConn.innerText = (conn.effectiveType || "Unknown").toUpperCase();
    ui.devHw.innerText = `${navigator.hardwareConcurrency || "Unknown"} Cores / ${navigator.deviceMemory || "Unknown"}GB RAM`;
    ui.devGpu.innerText = getCleanGPU();
    if (navigator.storage && navigator.storage.estimate) {
        const { quota } = await navigator.storage.estimate();
        ui.devStorage.innerText = (quota / 1024 / 1024 / 1024).toFixed(1) + " GB Cache";
    }
}

async function fetchServerInfo() {
    try {
        const res = await fetch('/server-info');
        const data = await res.json();
        document.getElementById('server-details').innerHTML = `Connected to: <span style="color: #E11D48; font-weight: bold;">${data.nodeName}</span> [${data.ip}]`;
        ui.srvIsp.innerText = data.isp;
        ui.srvOrg.innerText = data.org;
        ui.srvIp.innerText = `${data.as} / ${data.ip}`;
        ui.srvLoc.innerText = `${data.city}, ${data.country}`;
    } catch (e) { console.error("Server info failed"); }
}

async function measurePing() {
    const start = performance.now();
    await fetch(`/ping?t=${Date.now()}`);
    return performance.now() - start;
}

async function runTest() {
    startBtn.disabled = true;
    techSection.style.display = 'none';
    try {
        statusText.innerText = "Measuring baseline network health...";
        const pings = [];
        for (let i = 0; i < 10; i++) { pings.push(await measurePing()); }
        const avgPing = pings.reduce((a, b) => a + b) / pings.length;
        let jitterSum = 0;
        for (let i = 1; i < pings.length; i++) { jitterSum += Math.abs(pings[i] - pings[i-1]); }
        ui.ping.innerText = avgPing.toFixed(0) + " ms";
        ui.jitter.innerText = (jitterSum / (pings.length - 1)).toFixed(0) + " ms";

        const resource = performance.getEntriesByName(window.location.origin + '/ping')[0];
        if (resource) {
            ui.dnsPing.innerText = (resource.domainLookupEnd - resource.domainLookupStart).toFixed(0) + " ms";
            ui.tcpPing.innerText = (resource.connectEnd - resource.connectStart).toFixed(0) + " ms";
        }

        statusText.innerText = "Saturating download channel...";
        const dlStart = performance.now();
        const dlResponse = await fetch(`/download?t=${Date.now()}`);
        const reader = dlResponse.body.getReader();
        let receivedBytes = 0, loadedPings = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            receivedBytes += value.length;
            if (receivedBytes % (5 * 1024 * 1024) < value.length) { loadedPings.push(await measurePing()); }
            const currentDuration = (performance.now() - dlStart) / 1000;
            mainDl.innerText = ((receivedBytes * 8) / (currentDuration * 1000000)).toFixed(1);
        }
        const finalDlMbps = (receivedBytes * 8) / ((performance.now() - dlStart) / 1000 * 1000000);
        ui.dlPing.innerText = (loadedPings.reduce((a, b) => a + b, 0) / loadedPings.length).toFixed(0) + " ms";
        ui.dlStability.innerText = finalDlMbps > 40 ? "High" : "Stable";
        ui.dlData.innerText = (receivedBytes / 1024 / 1024).toFixed(1) + " MB";
        mainDl.innerText = finalDlMbps.toFixed(1);
        ui.devConn.innerText = getNetworkAccuracy(finalDlMbps);

        statusText.innerText = "Saturating upload channel...";
        const uploadSize = 20 * 1024 * 1024;
        const uploadData = new Uint8Array(uploadSize);
        for (let i = 0; i < uploadSize; i += 65536) { crypto.getRandomValues(uploadData.subarray(i, Math.min(i + 65536, uploadSize))); }
        const preUlPing = await measurePing();
        const ulStart = performance.now();
        await fetch('/upload', { method: 'POST', body: uploadData });
        const ulEnd = performance.now();
        const finalUlMbps = (uploadSize * 8) / ((ulEnd - ulStart) / 1000 * 1000000);
        ui.ulPing.innerText = preUlPing.toFixed(0) + " ms";
        ui.ulStability.innerText = finalUlMbps > 10 ? "High" : "Stable";
        ui.ulData.innerText = (uploadSize / 1024 / 1024).toFixed(1) + " MB";
        mainUl.innerText = finalUlMbps.toFixed(1);

        statusText.innerText = "Analysis Complete";
        techSection.style.display = 'block';
    } catch (error) {
        statusText.innerText = "Error: " + error.message;
    } finally { startBtn.disabled = false; }
}

fetchServerInfo();
fetchLocalSystemInfo();
startBtn.addEventListener('click', runTest);
