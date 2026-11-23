import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error("Users GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, body.username))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "نام کاربری تکراری است" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(body.password);

    const [newUser] = await db
      .insert(users)
      .values({
        username: body.username,
        password: hashedPassword,
        fullName: body.fullName,
        email: body.email || null,
        phone: body.phone || null,
        role: body.role || "viewer",
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      });

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Users POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
