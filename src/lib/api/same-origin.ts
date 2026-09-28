export function rejectCrossOriginPost(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (request.method === "POST" && (!origin || origin !== url.origin || !loopback)) {
    return Response.json({ error: "This local endpoint only accepts same-origin requests." }, { status: 403 });
  }
  return null;
}
