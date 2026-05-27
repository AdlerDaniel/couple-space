import { getVapidPublicKey, isPushConfigured } from "@/lib/pushServer";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    publicKey: getVapidPublicKey(),
    configured: isPushConfigured(),
  });
}
