
import { checkApiHealth } from "@/lib/api-check";
import { NextResponse } from "next/server";

export async function GET() {
  const health = await checkApiHealth();
  return NextResponse.json(health);
}
