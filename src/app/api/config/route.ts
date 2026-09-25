import { ASK_MODEL, FLUX_SCHNELL, isAskModelId, isFluxModelId } from "@/lib/charts/models";

export const runtime = "nodejs";

export function GET() {
  const ask = process.env.PAPER_LENS_ASK_MODEL;
  const flux = process.env.PAPER_LENS_FLUX_MODEL;
  return Response.json({
    mockMode: process.env.PAPER_LENS_MOCK !== "0",
    appleOcrAvailable: process.platform === "darwin",
    askModel: ask && isAskModelId(ask) ? ask : ASK_MODEL,
    fluxModel: flux && isFluxModelId(flux) ? flux : FLUX_SCHNELL,
  });
}
