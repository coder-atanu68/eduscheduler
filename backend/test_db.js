const dns = require('dns');
const mongoose = require('mongoose');
require('dotenv').config();

console.log('Testing DNS SRV resolution...');
dns.resolveSrv('_mongodb._tcp.cluster0.0mtm37o.mongodb.net', function(err, addr) {
  if (err) {
    console.log('DNS SRV FAILED:', err.code, '-', err.message);
    console.log('\nYour network is blocking SRV DNS queries (common on college networks).');
    console.log('Solution: Use a hotspot (mobile data) instead of college WiFi.');
  } else {
    console.log('DNS SRV OK:', JSON.stringify(addr));
    console.log('\nDNS is fine! Testing MongoDB connection...');
    mongoose.connect(process.env.MONGODB_URI).then(function() {
      console.log('MONGODB CONNECTED SUCCESSFULLY!');
      process.exit(0);
    }).catch(function(e) {
      console.log('MONGODB ERROR:', e.message);
      process.exit(1);
    });
  }
});
