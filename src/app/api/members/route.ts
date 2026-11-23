import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { members, loans } from "@/db/schema";
import { eq, like, or, desc, count, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { generateMemberCode } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;
    const activeOnly = searchParams.get("active") === "true";

    let query = db.select({
      id: members.id,
      memberCode: members.memberCode,
      firstName: members.firstName,
      lastName: members.lastName,
      nationalId: members.nationalId,
      phone: members.phone,
      phone2: members.phone2,
      email: members.email,
      address: members.address,
      city: members.city,
      department: members.department,
      jobTitle: members.jobTitle,
      employeeId: members.employeeId,
      isActive: members.isActive,
      joinDate: members.joinDate,
      guarantorName: members.guarantorName,
      guarantorPhone: members.guarantorPhone,
      notes: members.notes,
      createdAt: members.createdAt,
    }).from(members).$dynamic();

    if (search) {
      query = query.where(
        or(
          like(members.firstName, `%${search}%`),
          like(members.lastName, `%${search}%`),
          like(members.nationalId, `%${search}%`),
          like(members.phone, `%${search}%`),
          like(members.memberCode, `%${search}%`),
          like(members.employeeId, `%${search}%`)
        )
      );
    }

    if (activeOnly) {
      query = query.where(eq(members.isActive, true));
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(members)
      .where(
        search
          ? or(
              like(members.firstName, `%${search}%`),
              like(members.lastName, `%${search}%`),
              like(members.nationalId, `%${search}%`),
              like(members.phone, `%${search}%`),
              like(members.memberCode, `%${search}%`)
            )
          : undefined
      );

    const results = await query.orderBy(desc(members.createdAt)).limit(limit).offset(offset);

    return NextResponse.json({
      members: results,
      total: totalResult.count,
      page,
      limit,
    });
  } catch (error) {
    console.error("Members GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "viewer") return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();

    // Check duplicate national ID
    const existing = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.nationalId, body.nationalId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "کد ملی تکراری است" }, { status: 400 });
    }

    const memberCode = generateMemberCode();

    const [newMember] = await db
      .insert(members)
      .values({
        memberCode,
        firstName: body.firstName,
        lastName: body.lastName,
        nationalId: body.nationalId,
        phone: body.phone,
        phone2: body.phone2 || null,
        email: body.email || null,
        address: body.address || null,
        city: body.city || null,
        postalCode: body.postalCode || null,
        birthDate: body.birthDate || null,
        jobTitle: body.jobTitle || null,
        department: body.department || null,
        employeeId: body.employeeId || null,
        guarantorName: body.guarantorName || null,
        guarantorPhone: body.guarantorPhone || null,
        guarantorNationalId: body.guarantorNationalId || null,
        isActive: true,
        notes: body.notes || null,
        joinDate: body.joinDate || new Date().toISOString().split("T")[0],
        createdBy: session.userId,
      })
      .returning();

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error("Members POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
