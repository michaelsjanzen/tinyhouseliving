import type { PostFeedSection } from "../../../../src/types/homepage-sections";
import { fetchPostPage } from "../../../../src/lib/queries/posts";
import { PostFeed } from "../HomeView";
import type { HomeLayoutConfig } from "../../design";

interface Props {
  section: PostFeedSection;
  page?: number;
  basePath?: string;
}

export async function PostFeedRenderer({ section, page = 1, basePath = "/" }: Props) {
  const layoutConfig: HomeLayoutConfig = {
    feedStyle: section.feedStyle,
    listStyle: section.listStyle,
    columns: Number(section.columns) as 1 | 2 | 3,
    gap: section.gap,
    contentDisplay: section.contentDisplay,
  };

  const postPage = await fetchPostPage({
    page,
    categorySlug: section.categorySlug || undefined,
    limit: section.limit || 0,
    // Hide featured posts from the homepage post-feed — they appear in the
    // dedicated Featured Post section instead and shouldn't double up.
    // /blog, /category, and /tag listings continue to include featured posts
    // since those are filtered views the reader chose.
    excludeFeatured: true,
  });

  if (postPage.posts.length === 0) return null;

  return (
    <div className="space-y-6">
      {section.heading && (
        <h2 className="text-2xl font-bold">{section.heading}</h2>
      )}
      <PostFeed
        posts={postPage.posts}
        layoutConfig={layoutConfig}
        pagination={
          section.showPagination
            ? { page: postPage.page, totalPages: postPage.totalPages }
            : undefined
        }
        paginationBasePath={basePath}
      />
    </div>
  );
}
