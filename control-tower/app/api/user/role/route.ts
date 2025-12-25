import { NextResponse } from "next/server";
import { auth } from "@/auth"; 
import jwt from "jsonwebtoken";

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role || "user"; 
  
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET is missing in .env");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const roleToken = jwt.sign(
  {
    sub: session.user.id,
    role: userRole,
    purpose: "viz-access",
  },
  secret,
  {
    expiresIn: "10m",
    issuer: "mulehunter-frontend",
  }
);


  return NextResponse.json({ roleToken });
}