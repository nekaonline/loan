import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { fundTransactions, members } from "@/db/schema";
import { eq, desc, sum, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getIranTodayISO, normalizeDateInput } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const transactions = await db
      .select({
        id: fundTransactions.id,
        type: fundTransactions.type,
        amount: fundTransactions.amount,
        description: fundTransactions.description,
        referenceNo: fundTransactions.referenceNo,
        transactionDate: fundTransactions.transactionDate,
        createdAt: fundTransactions.createdAt,
        memberId: fundTransactions.memberId,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
      })
      .from(fundTransactions)
      .leftJoin(members, eq(fundTransactions.memberId, members.id))
      .orderBy(desc(fundTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Calculate balance
    const byType = await db
      .select({
        type: fundTransactions.type,
        total: sum(fundTransactions.amount),
      })
      .from(fundTransactions)
      .groupBy(fundTransactions.type);

    let balance = 0;
    for (const t of byType) {
      balance += parseFloat(t.total || "0");
    }

    return NextResponse.json({ transactions, balance });
  } catch (error) {
    console.error("Fund GET error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "viewer")
      return NextResponse.json({ error: "دسترسی محدود" }, { status: 403 });

    const body = await req.json();

    const [newTransaction] = await db
      .insert(fundTransactions)
      .values({
        type: body.type,
        amount: body.amount.toString(),
        description: body.description || null,
        memberId: body.memberId ? parseInt(body.memberId) : null,
        referenceNo: body.referenceNo || null,
        transactionDate:
          normalizeDateInput(body.transactionDate) || getIranTodayISO(),
        createdBy: session.userId,
      })
      .returning();

    return NextResponse.json({ transaction: newTransaction }, { status: 201 });
  } catch (error) {
    console.error("Fund POST error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
