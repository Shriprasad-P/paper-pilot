import {
  FLUX_SCHNELL,
  VLM_8B_MODEL,
  isChartModelId,
  isFluxModelId,
} from "@/lib/charts/models";

export const runtime = "nodejs";

export function GET() {
  const vl = process.env.PAPER_LENS_VLM_MODEL;
  const flux = process.env.PAPER_LENS_FLUX_MODEL;
  return Response.json({
    mockMode: process.env.PAPER_LENS_MOCK !== "0",
    chartModel: vl && isChartModelId(vl) ? vl : VLM_8B_MODEL,
    fluxModel: flux && isFluxModelId(flux) ? flux : FLUX_SCHNELL,
  });
}
