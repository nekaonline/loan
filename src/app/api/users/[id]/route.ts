import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession, hashPassword } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin" && session.userId !== parseInt((await params).id))
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id);
    const body = await req.json();

    const updateData: Partial<typeof users.$inferInsert> = {
      fullName: body.fullName,
      email: body.email || null,
      phone: body.phone || null,
      updatedAt: new Date(),
    };

    if (session.role === "admin") {
      updateData.role = body.role;
      updateData.isActive = body.isActive;
    }

    if (body.password) {
      updateData.password = await hashPassword(body.password);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("User PUT error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role !== "admin")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id);

    if (userId === session.userId) {
      return NextResponse.json(
        { error: "نمی‌توانید حساب خود را حذف کنید" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return NextResponse.json({ message: "کاربر غیرفعال شد" });
  } catch (error) {
    console.error("User DELETE error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
