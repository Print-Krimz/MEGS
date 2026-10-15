import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP, BlockList } from "node:net";
import { MAX_DOCUMENT_BYTES } from "./file-validation.js";

export function approvedLegacyHosts(): Set<string> {
  const hosts = new Set((process.env.LEGACY_RESUME_HOSTS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
  if (process.env.SUPABASE_URL) hosts.add(new URL(process.env.SUPABASE_URL).hostname.toLowerCase());
  return hosts;
}

export function validateLegacyResumeUrl(value: string, hosts = approvedLegacyHosts()): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid legacy resume URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443" || !hosts.has(url.hostname.toLowerCase()) || isIP(url.hostname.replace(/^\[|\]$/g, ""))) throw new Error("Legacy resume destination is not approved");
  return url;
}

const globalIpv6 = new BlockList(); globalIpv6.addSubnet("2000::", 3, "ipv6");
const specialIpv6 = new BlockList();
for (const [address, prefix] of [["2001::",23], ["2001:db8::",32], ["2002::",16], ["3fff::",20]] as const) specialIpv6.addSubnet(address, prefix, "ipv6");
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a !== 0 && a !== 10 && a !== 127 && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18, 19, 51].includes(b)) && !(a === 203 && b === 0) && a! >= 1 && a! < 224;
  }
  // Only native global-unicast IPv6 is accepted. This excludes loopback,
  // link/local addresses, multicast, IPv4 mapping and transition tunnels.
  return isIP(address) === 6 && globalIpv6.check(address, "ipv6") && !specialIpv6.check(address, "ipv6");
}

export async function downloadLegacyResume(value: string): Promise<{ buffer: Buffer; mimeType?: string; originalName?: string }> {
  const url = validateLegacyResumeUrl(value);
  const deadline = Date.now() + 15_000;
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("Resume DNS lookup timed out")), 3_000); dnsTimer.unref(); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some(result => !isPublicAddress(result.address))) throw new Error("Legacy resume destination resolved to a restricted address");
  // Pin the validated address in the actual TLS connection; never re-resolve
  // through fetch. The hostname remains the SNI/certificate verification name.
  const address = addresses[0]!;
  return await new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", agent: false,
      lookup: (_host, options, callback) => {
        if (options.all) (callback as unknown as (error: null, addresses: Array<{ address: string; family: number }>) => void)(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      },
      timeout: Math.max(1, deadline - Date.now()),
      headers: { "Accept-Encoding": "identity" },
    }, response => {
      // Legacy redirects are deliberately rejected, including redirects to an
      // approved host: owners can configure the final canonical URL instead.
      if (response.statusCode !== 200 || response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity" || Number(response.headers["content-length"] || 0) > MAX_DOCUMENT_BYTES) {
        response.destroy(); req.destroy(); reject(new Error("Legacy resume response is not supported")); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_DOCUMENT_BYTES) { req.destroy(new Error("Resume download exceeds size limits")); return; }
        chunks.push(chunk);
      });
      response.on("error", () => reject(new Error("Unable to download legacy resume")));
      response.once("aborted", () => req.destroy(new Error("Legacy resume download was interrupted")));
      response.on("end", () => resolve({ buffer: Buffer.concat(chunks), mimeType: response.headers["content-type"]?.split(";")[0]?.trim(), originalName: url.pathname.split("/").pop() }));
    });
    const timer = setTimeout(() => req.destroy(new Error("Resume download timed out")), Math.max(1, deadline - Date.now()));
    req.once("close", () => { clearTimeout(timer); reject(new Error("Legacy resume download ended before completion")); });
    req.once("timeout", () => req.destroy(new Error("Resume download timed out")));
    req.once("error", () => reject(new Error("Unable to download legacy resume")));
    req.end();
  });
}
