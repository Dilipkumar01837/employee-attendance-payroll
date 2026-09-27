const dns = require("node:dns");

// A `mongodb+srv://` URI is resolved by first querying SRV records. Some OS
// resolvers (and some corporate/ISP setups) refuse those queries outright, which
// surfaces as `querySrv ECONNREFUSED` from the driver and looks like a network
// problem even though the cluster is perfectly reachable.
//
// Setting DNS_SERVERS to a comma separated list of resolvers that do answer SRV
// queries works around that. `dns.setServers` only affects the `dns.resolve*`
// family (c-ares) and never `dns.lookup` (getaddrinfo), so a plain
// `mongodb://host` URI and localhost resolution are unaffected either way.
//
// This is deliberately opt-in: forcing public resolvers on every developer and
// in production would be the wrong default, so the variable is empty unless set.
const configured = (process.env.DNS_SERVERS || "")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (configured.length > 0) {
  dns.setServers(configured);
  console.log(`DNS override active: ${configured.join(", ")}`);
}

module.exports = { dnsServersConfigured: configured.length > 0 };
