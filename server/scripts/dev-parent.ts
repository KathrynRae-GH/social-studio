// Local stand-in for Boutiqly, for development only. Serves a page on
// http://localhost:5174 that shows the tab (http://localhost:3000) in a frame
// and answers its "who's looking" request with a test user, encrypted with
// the local shared secret. Pick the person with ?as=agency|owner|staff|other.
//
//   BOUTIQLY_SHARED_SECRET=dev-secret BOUTIQLY_APP_DOMAINS=http://localhost:5174 npm start
//   BOUTIQLY_SHARED_SECRET=dev-secret npm run dev-parent -w server   (second terminal)
import { createServer } from "node:http";
import { encryptLikeBoutiqly, people } from "../test/helpers.ts";

const secret = process.env.BOUTIQLY_SHARED_SECRET ?? "dev-secret";
const tab = process.env.TAB_URL ?? "http://localhost:3000";

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const who = (url.searchParams.get("as") ?? "agency") as keyof typeof people;
  const payload = encryptLikeBoutiqly(people[who] ?? people.agency, secret);
  const width = url.searchParams.get("width") ?? "100%";
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(`<!doctype html><title>Boutiqly (local stand-in)</title>
<body style="margin:0;font-family:sans-serif;background:#eee">
<div style="padding:6px 12px;background:#333;color:#fff;font-size:13px">Local stand-in for Boutiqly · signed in as ${who}</div>
<iframe id="tab" src="${tab}" style="border:0;width:${width};height:calc(100vh - 30px);background:#fff"></iframe>
<script>
const payload = ${JSON.stringify(payload)};
addEventListener("message", (e) => {
  if (e.data && e.data.message === "REQUEST_USER_DATA") {
    e.source.postMessage({ message: "REQUEST_USER_DATA_RESPONSE", payload }, "*");
  }
});
</script></body>`);
}).listen(5174, () => console.log("Boutiqly stand-in on http://localhost:5174 (?as=agency|owner|staff|other)"));
