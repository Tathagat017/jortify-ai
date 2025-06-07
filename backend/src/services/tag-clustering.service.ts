import { supabase } from "../lib/supabase";

export interface TagCluster {
  clusterId: string;
  tags: string[];
  clusterName: string;
  commonThemes: string[];
}

export class TagClusteringService {
  /**
   * Get tag clusters for a workspace
   * Groups tags based on semantic similarity and co-occurrence
   */
  static async getWorkspaceTagClusters(
    workspaceId: string
  ): Promise<Map<string, TagCluster>> {
    try {
      // Get all tags in the workspace
      const { data: tags, error: tagsError } = await supabase
        .from("tags")
        .select("id, name")
        .eq("workspace_id", workspaceId);

      if (tagsError || !tags || tags.length === 0) {
        return new Map();
      }

      // Get tag co-occurrence data
      const { data: pageTagData, error: pageTagError } = await supabase
        .from("page_tags")
        .select(
          `
          page_id,
          tag_id,
          tags!inner(name, workspace_id)
        `
        )
        .eq("tags.workspace_id", workspaceId);

      if (pageTagError || !pageTagData) {
        console.warn("Failed to fetch page tag data:", pageTagError);
        return new Map();
      }

      // Build co-occurrence matrix
      const coOccurrenceMap = new Map<string, Map<string, number>>();
      const tagNameMap = new Map<string, string>();

      // Initialize maps
      for (const tag of tags) {
        tagNameMap.set(tag.id, tag.name);
        coOccurrenceMap.set(tag.id, new Map());
      }

      // Group tags by page
      const pageTagGroups = new Map<string, string[]>();
      for (const pt of pageTagData) {
        if (!pageTagGroups.has(pt.page_id)) {
          pageTagGroups.set(pt.page_id, []);
        }
        pageTagGroups.get(pt.page_id)!.push(pt.tag_id);
      }

      // Calculate co-occurrences
      for (const tagIds of pageTagGroups.values()) {
        for (let i = 0; i < tagIds.length; i++) {
          for (let j = i + 1; j < tagIds.length; j++) {
            const tag1 = tagIds[i];
            const tag2 = tagIds[j];

            // Increment co-occurrence count
            const count1 = coOccurrenceMap.get(tag1)?.get(tag2) || 0;
            coOccurrenceMap.get(tag1)!.set(tag2, count1 + 1);

            const count2 = coOccurrenceMap.get(tag2)?.get(tag1) || 0;
            coOccurrenceMap.get(tag2)!.set(tag1, count2 + 1);
          }
        }
      }

      // Create clusters based on co-occurrence and semantic similarity
      const clusters = this.createClusters(tags, coOccurrenceMap, tagNameMap);

      return clusters;
    } catch (error) {
      console.error("Error getting tag clusters:", error);
      return new Map();
    }
  }

  /**
   * Create clusters from tags based on co-occurrence and semantic patterns
   */
  private static createClusters(
    tags: Array<{ id: string; name: string }>,
    coOccurrenceMap: Map<string, Map<string, number>>,
    tagNameMap: Map<string, string>
  ): Map<string, TagCluster> {
    const clusters = new Map<string, TagCluster>();
    const assignedTags = new Set<string>();

    // Predefined semantic clusters based on common themes
    const semanticGroups = [
      {
        clusterId: "tech",
        keywords: [
          "api",
          "code",
          "tech",
          "development",
          "programming",
          "software",
          "database",
          "backend",
          "frontend",
        ],
        clusterName: "Technical",
        themes: ["Technology", "Development", "Programming"],
      },
      {
        clusterId: "ai-ml",
        keywords: [
          "ai",
          "ml",
          "machine learning",
          "artificial intelligence",
          "neural",
          "model",
          "data",
          "algorithm",
        ],
        clusterName: "AI & Machine Learning",
        themes: ["AI", "Machine Learning", "Data Science"],
      },
      {
        clusterId: "business",
        keywords: [
          "business",
          "sales",
          "marketing",
          "revenue",
          "customer",
          "strategy",
          "growth",
          "market",
        ],
        clusterName: "Business",
        themes: ["Business", "Strategy", "Growth"],
      },
      {
        clusterId: "education",
        keywords: [
          "education",
          "training",
          "course",
          "learning",
          "tutorial",
          "guide",
          "documentation",
          "instruction",
        ],
        clusterName: "Education & Training",
        themes: ["Education", "Learning", "Training"],
      },
      {
        clusterId: "design",
        keywords: [
          "design",
          "ui",
          "ux",
          "interface",
          "visual",
          "graphic",
          "layout",
          "style",
        ],
        clusterName: "Design",
        themes: ["Design", "UI/UX", "Visual"],
      },
      {
        clusterId: "security",
        keywords: [
          "security",
          "auth",
          "authentication",
          "encryption",
          "privacy",
          "secure",
          "protection",
        ],
        clusterName: "Security",
        themes: ["Security", "Authentication", "Privacy"],
      },
    ];

    // First pass: Assign tags to semantic clusters
    for (const tag of tags) {
      const tagNameLower = tag.name.toLowerCase();

      for (const group of semanticGroups) {
        const matches = group.keywords.some(
          (keyword) =>
            tagNameLower.includes(keyword) || keyword.includes(tagNameLower)
        );

        if (matches && !assignedTags.has(tag.id)) {
          if (!clusters.has(group.clusterId)) {
            clusters.set(group.clusterId, {
              clusterId: group.clusterId,
              tags: [],
              clusterName: group.clusterName,
              commonThemes: group.themes,
            });
          }

          clusters.get(group.clusterId)!.tags.push(tag.id);
          assignedTags.add(tag.id);
          break;
        }
      }
    }

    // Second pass: Use co-occurrence to refine clusters
    for (const [tagId, coOccurrences] of coOccurrenceMap.entries()) {
      if (assignedTags.has(tagId)) continue;

      // Find which cluster this tag co-occurs with most
      const clusterScores = new Map<string, number>();

      for (const [coTagId, count] of coOccurrences.entries()) {
        // Find which cluster the co-occurring tag belongs to
        for (const [clusterId, cluster] of clusters.entries()) {
          if (cluster.tags.includes(coTagId)) {
            const currentScore = clusterScores.get(clusterId) || 0;
            clusterScores.set(clusterId, currentScore + count);
          }
        }
      }

      // Assign to cluster with highest co-occurrence score
      if (clusterScores.size > 0) {
        const bestCluster = Array.from(clusterScores.entries()).sort(
          (a, b) => b[1] - a[1]
        )[0][0];

        clusters.get(bestCluster)!.tags.push(tagId);
        assignedTags.add(tagId);
      }
    }

    // Third pass: Create "Other" cluster for unassigned tags
    const unassignedTags = tags.filter((tag) => !assignedTags.has(tag.id));
    if (unassignedTags.length > 0) {
      clusters.set("other", {
        clusterId: "other",
        tags: unassignedTags.map((tag) => tag.id),
        clusterName: "Other",
        commonThemes: ["Miscellaneous"],
      });
    }

    return clusters;
  }

  /**
   * Calculate cluster-based relevance bonus for link suggestions
   */
  static async calculateClusterRelevance(
    currentPageTags: string[],
    targetPageTags: string[],
    workspaceId: string
  ): Promise<number> {
    try {
      // Get clusters for the workspace
      const clusters = await this.getWorkspaceTagClusters(workspaceId);

      // Find which clusters the current page belongs to
      const currentPageClusters = new Set<string>();
      for (const tagId of currentPageTags) {
        for (const [clusterId, cluster] of clusters.entries()) {
          if (cluster.tags.includes(tagId)) {
            currentPageClusters.add(clusterId);
          }
        }
      }

      // Find which clusters the target page belongs to
      const targetPageClusters = new Set<string>();
      for (const tagId of targetPageTags) {
        for (const [clusterId, cluster] of clusters.entries()) {
          if (cluster.tags.includes(tagId)) {
            targetPageClusters.add(clusterId);
          }
        }
      }

      // Calculate overlap
      const commonClusters = Array.from(currentPageClusters).filter(
        (clusterId) => targetPageClusters.has(clusterId)
      );

      // Score based on cluster overlap
      if (commonClusters.length === 0) {
        return 0;
      }

      // Higher score for more specific clusters (not "other")
      let score = 0;
      for (const clusterId of commonClusters) {
        if (clusterId === "other") {
          score += 0.05; // Small bonus for "other" cluster
        } else {
          score += 0.15; // Larger bonus for specific clusters
        }
      }

      return Math.min(score, 0.3); // Cap at 30% bonus
    } catch (error) {
      console.error("Error calculating cluster relevance:", error);
      return 0;
    }
  }

  /**
   * Get suggested tags based on cluster membership
   */
  static async getSuggestedTagsFromCluster(
    existingTags: string[],
    workspaceId: string,
    limit: number = 5
  ): Promise<Array<{ id: string; name: string; reason: string }>> {
    try {
      const clusters = await this.getWorkspaceTagClusters(workspaceId);
      const suggestions: Array<{ id: string; name: string; reason: string }> =
        [];

      // Find clusters that contain existing tags
      const relevantClusters = new Set<string>();
      for (const tagId of existingTags) {
        for (const [clusterId, cluster] of clusters.entries()) {
          if (cluster.tags.includes(tagId)) {
            relevantClusters.add(clusterId);
          }
        }
      }

      // Get all tags from relevant clusters
      const candidateTags = new Set<string>();
      for (const clusterId of relevantClusters) {
        const cluster = clusters.get(clusterId)!;
        for (const tagId of cluster.tags) {
          if (!existingTags.includes(tagId)) {
            candidateTags.add(tagId);
          }
        }
      }

      // Get tag details
      if (candidateTags.size > 0) {
        const { data: tags, error } = await supabase
          .from("tags")
          .select("id, name")
          .in("id", Array.from(candidateTags))
          .limit(limit);

        if (!error && tags) {
          for (const tag of tags) {
            // Find which cluster this tag belongs to
            let clusterName = "Related";
            for (const [clusterId, cluster] of clusters.entries()) {
              if (cluster.tags.includes(tag.id)) {
                clusterName = cluster.clusterName;
                break;
              }
            }

            suggestions.push({
              id: tag.id,
              name: tag.name,
              reason: `From ${clusterName} cluster`,
            });
          }
        }
      }

      return suggestions;
    } catch (error) {
      console.error("Error getting suggested tags from cluster:", error);
      return [];
    }
  }
}
