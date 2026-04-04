import http from 'http';
import express from 'express';

const isLocalOrigin = (origin) => {
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
};

console.log("Malformed:", isLocalOrigin("not-a-valid-url"));
console.log("10.evil.com:", isLocalOrigin("http://10.evil.com"));
console.log("192.168.evil.com:", isLocalOrigin("http://192.168.evil.com"));
console.log("evil.com:", isLocalOrigin("http://evil.com"));
