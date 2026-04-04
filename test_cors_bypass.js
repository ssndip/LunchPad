function isLocalOrigin(origin) {
  if (!origin || origin === 'null') return true;
  try {
    const u = new URL(origin);
    const hostname = u.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '0.0.0.0') return true;
    if (hostname.startsWith('192.168.')) return true;
    if (hostname.startsWith('10.')) return true;
    if (hostname.startsWith('172.')) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const secondOctet = parseInt(parts[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
      }
    }
    if (!hostname.includes('.')) return true;
  } catch (e) {
    return true;
  }
  return false;
}

console.log("http://10.evil.com ->", isLocalOrigin("http://10.evil.com"));
console.log("http://192.168.evil.com ->", isLocalOrigin("http://192.168.evil.com"));
console.log("http://172.16.evil.com ->", isLocalOrigin("http://172.16.evil.com"));
console.log("http://172.31.evil.com ->", isLocalOrigin("http://172.31.evil.com"));
console.log("http://172.32.evil.com ->", isLocalOrigin("http://172.32.evil.com"));
