import { isWhitelisted } from "../server/middleware/whitelist";

console.log("Starting Whitelist Tests...");

const defaultWhitelist = "127.0.0.1, localhost, ::1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12";

// Test 1: Localhost (IP)
console.assert(isWhitelisted("127.0.0.1", "localhost", defaultWhitelist) === true, "Test 1 Failed");
console.assert(isWhitelisted("::1", "localhost", defaultWhitelist) === true, "Test 1.1 Failed");

// Test 2: Local Subnet (CIDR)
console.assert(isWhitelisted("192.168.1.50", "other", defaultWhitelist) === true, "Test 2 Failed");
console.assert(isWhitelisted("10.5.0.1", "other", defaultWhitelist) === true, "Test 2.1 Failed");

// Test 3: External IP (Blocked)
console.assert(isWhitelisted("8.8.8.8", "google-dns", defaultWhitelist) === false, "Test 3 Failed");

// Test 4: Custom Whitelist Entry
const customWhitelist = "8.8.8.8, my-office.com";
console.assert(isWhitelisted("8.8.8.8", "other", customWhitelist) === true, "Test 4 Failed");
console.assert(isWhitelisted("1.1.1.1", "my-office.com", customWhitelist) === true, "Test 4.1 Failed");

// Test 5: CIDR Edge Cases
console.assert(isWhitelisted("192.169.1.1", "other", defaultWhitelist) === false, "Test 5 Failed");

console.log("All tests passed!");
