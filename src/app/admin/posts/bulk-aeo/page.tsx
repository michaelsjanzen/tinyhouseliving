import type { Metadata } from "next";
export const metadata: Metadata = { title: "Bulk AEO" };

import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/get-current-user";
import { isAiConfigured } from "@/lib/ai";
import { redirect } from "next/navigation";
import BulkAeoClient from "./BulkAeoClient";

export default async function BulkAeoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");

  const [allPosts, aiEnabled] = await Promise.all([
    db
      .select({
        id: posts.id,
        title: posts.title,
        type: posts.type,
        aeoMetadata: posts.aeoMetadata,
      })
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.createdAt)),
    isAiConfigured(),
  ]);

  const postList = allPosts.map(p => ({
    id: p.id,
    title: p.title,
    type: (p.type ?? "post") as "post" | "page",
    hasAeo: !!(
      p.aeoMetadata &&
      typeof p.aeoMetadata === "object" &&
      ((p.aeoMetadata as Record<string, unknown>).summary as string | undefined)?.trim()
    ),
  }));

  return <BulkAeoClient posts={postList} aiEnabled={aiEnabled} />;
}
