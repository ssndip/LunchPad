import net from 'net';

const isLocalOrigin = (origin) => {
  if (!origin || origin === 'null') return true;
  try {
    const u = new URL(origin);
    const hostname = u.hostname;
    
    if (hostname === 'localhost' || hostname === '[::1]') return true;
    
    if (net.isIPv4(hostname)) {
      if (hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
      if (hostname.startsWith('10.')) return true;
      if (hostname.startsWith('192.168.')) return true;
      if (hostname.startsWith('172.')) {
        const secondOctet = parseInt(hostname.split('.')[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
      }
    }
    
    if (!hostname.includes('.')) return true;
  } catch (e) {
    return false; 
  }
  return false;
};

console.log("Malformed:", isLocalOrigin("not-a-valid-url"));
console.log("10.evil.com:", isLocalOrigin("http://10.evil.com"));
console.log("192.168.evil.com:", isLocalOrigin("http://192.168.evil.com"));
console.log("172.16.evil.com:", isLocalOrigin("http://172.16.evil.com"));
console.log("evil.com:", isLocalOrigin("http://evil.com"));
console.log("192.168.1.5:", isLocalOrigin("http://192.168.1.5"));
console.log("10.0.0.1:", isLocalOrigin("http://10.0.0.1"));
console.log("172.20.0.5:", isLocalOrigin("http://172.20.0.5"));
console.log("localhost:", isLocalOrigin("http://localhost:3000"));
console.log("lunchpad:", isLocalOrigin("http://lunchpad"));
