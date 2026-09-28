export function rejectCrossOriginPost(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const isLoopback = (hostname: string) =>
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]" || hostname === "::1";
  let originUrl: URL | null = null;
  try {
    originUrl = origin ? new URL(origin) : null;
  } catch {
    originUrl = null;
  }
  const sameOrigin = originUrl?.origin === url.origin;
  const sameLoopback =
    originUrl?.protocol === url.protocol &&
    originUrl.port === url.port &&
    isLoopback(originUrl.hostname) &&
    isLoopback(url.hostname);
  if (
    request.method === "POST" &&
    (!originUrl || originUrl.origin !== origin || (!sameOrigin && !sameLoopback) || !isLoopback(url.hostname))
  ) {
    return Response.json({ error: "This local endpoint only accepts same-origin requests." }, { status: 403 });
  }
  return null;
}
