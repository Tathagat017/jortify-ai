# Knowledge Graph Detailed Flow Documentation

## Database Schema Usage

### Core Tables

**pages**

```sql
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB DEFAULT '{}',
    parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `parent_id`: Creates hierarchical relationships between pages
- `content`: BlockNote JSON containing links and references

**page_links**

```sql
CREATE TABLE page_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'reference',
    context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_page_id, target_page_id, link_type)
);
```

- `source_page_id`: Page containing the link
- `target_page_id`: Page being linked to
- `link_type`: Type of relationship (reference, parent-child, tag-based)
- `context`: Surrounding text context of the link

**page_similarities**

```sql
CREATE TABLE page_similarities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page1_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    page2_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    similarity_type TEXT NOT NULL DEFAULT 'content',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page1_id, page2_id, similarity_type),
    CHECK (page1_id < page2_id) -- Ensure consistent ordering
);
```

- `similarity_score`: Cosine similarity between page embeddings (0.0-1.0)
- `similarity_type`: Type of similarity (content, tag-based, title)
- `calculated_at`: When similarity was last computed

**graph_analytics**

```sql
CREATE TABLE graph_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    pagerank_score FLOAT DEFAULT 0.0,
    centrality_score FLOAT DEFAULT 0.0,
    community_id INTEGER,
    in_degree INTEGER DEFAULT 0,
    out_degree INTEGER DEFAULT 0,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, page_id)
);
```

- `pagerank_score`: PageRank algorithm score for page importance
- `centrality_score`: Betweenness centrality score
- `community_id`: Community detection cluster assignment
- `in_degree/out_degree`: Number of incoming/outgoing links

## Detailed Step-by-Step Flow

### Step 1: Graph Data Collection

**Link Extraction from Content:**

```typescript
// GraphService.extractLinksFromContent()
class GraphService {
  static async extractLinksFromContent(
    pageId: string,
    content: any
  ): Promise<void> {
    // Extract all page references from BlockNote content
    const extractedLinks = this.findPageReferences(content);

    // Get existing links for this page
    const { data: existingLinks } = await supabase
      .from("page_links")
      .select("target_page_id, link_type")
      .eq("source_page_id", pageId);

    const existingTargets = new Set(
      existingLinks?.map((link) => link.target_page_id) || []
    );

    // Process new links
    for (const link of extractedLinks) {
      if (!existingTargets.has(link.targetPageId)) {
        await this.createPageLink(pageId, link.targetPageId, link.context);
      }
    }

    // Remove links that no longer exist in content
    const currentTargets = new Set(
      extractedLinks.map((link) => link.targetPageId)
    );
    const linksToRemove =
      existingLinks?.filter(
        (link) => !currentTargets.has(link.target_page_id)
      ) || [];

    for (const linkToRemove of linksToRemove) {
      await supabase
        .from("page_links")
        .delete()
        .eq("source_page_id", pageId)
        .eq("target_page_id", linkToRemove.target_page_id);
    }
  }

  private static findPageReferences(content: any): PageReference[] {
    const references: PageReference[] = [];

    if (!content || !Array.isArray(content)) return references;

    const processBlock = (block: any, context: string = "") => {
      if (block.type === "paragraph" || block.type === "heading") {
        const blockText =
          block.content?.map((item: any) => item.text || "").join("") || "";

        // Find [[Page Title]] style links
        const linkMatches = blockText.match(/\[\[([^\]]+)\]\]/g);
        if (linkMatches) {
          for (const match of linkMatches) {
            const pageTitle = match.slice(2, -2); // Remove [[ and ]]
            references.push({
              targetPageTitle: pageTitle,
              context: blockText,
              linkType: "reference",
            });
          }
        }
      }

      // Process nested blocks
      if (block.children && Array.isArray(block.children)) {
        for (const child of block.children) {
          processBlock(child, context);
        }
      }
    };

    for (const block of content) {
      processBlock(block);
    }

    return references;
  }
}
```

**Database Operations for Link Creation:**

```sql
-- Create page link
INSERT INTO page_links (source_page_id, target_page_id, link_type, context)
VALUES ($1, $2, $3, $4)
ON CONFLICT (source_page_id, target_page_id, link_type)
DO UPDATE SET context = $4;

-- Update link degrees
UPDATE graph_analytics
SET out_degree = (
  SELECT COUNT(*) FROM page_links WHERE source_page_id = $1
)
WHERE page_id = $1;

UPDATE graph_analytics
SET in_degree = (
  SELECT COUNT(*) FROM page_links WHERE target_page_id = $2
)
WHERE page_id = $2;
```

### Step 2: Similarity Calculation

**Content-Based Similarity:**

```typescript
// GraphService.calculateContentSimilarities()
static async calculateContentSimilarities(workspaceId: string): Promise<void> {

  // Get all pages with embeddings in workspace
  const { data: pages } = await supabase
    .from('pages')
    .select(`
      id, title,
      page_embeddings!inner(embedding)
    `)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false);

  if (!pages || pages.length < 2) return;

  // Calculate pairwise similarities
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const page1 = pages[i];
      const page2 = pages[j];

      const embedding1 = JSON.parse(page1.page_embeddings.embedding);
      const embedding2 = JSON.parse(page2.page_embeddings.embedding);

      const similarity = this.cosineSimilarity(embedding1, embedding2);

      // Only store similarities above threshold
      if (similarity > 0.3) {
        await this.storeSimilarity(page1.id, page2.id, similarity, 'content');
      }
    }
  }
}

private static cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  return dotProduct / (magnitudeA * magnitudeB);
}
```

**Tag-Based Similarity:**

```typescript
// Calculate similarity based on shared tags
static async calculateTagSimilarities(workspaceId: string): Promise<void> {

  // Get pages with their tags
  const { data: pageTagData } = await supabase
    .from('pages')
    .select(`
      id,
      page_tags!inner(
        tag_id,
        tags!inner(name)
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false);

  // Group pages by tags
  const pagesByTag = new Map<string, string[]>();
  const pageTags = new Map<string, Set<string>>();

  for (const page of pageTagData || []) {
    const pageId = page.id;
    const tags = new Set<string>();

    for (const pageTag of page.page_tags) {
      const tagName = pageTag.tags.name;
      tags.add(tagName);

      if (!pagesByTag.has(tagName)) {
        pagesByTag.set(tagName, []);
      }
      pagesByTag.get(tagName)!.push(pageId);
    }

    pageTags.set(pageId, tags);
  }

  // Calculate Jaccard similarity for pages with shared tags
  const processedPairs = new Set<string>();

  for (const [pageId1, tags1] of pageTags) {
    for (const [pageId2, tags2] of pageTags) {
      if (pageId1 >= pageId2) continue; // Avoid duplicates and self-comparison

      const pairKey = `${pageId1}-${pageId2}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const intersection = new Set([...tags1].filter(tag => tags2.has(tag)));
      const union = new Set([...tags1, ...tags2]);

      if (intersection.size > 0) {
        const jaccardSimilarity = intersection.size / union.size;

        if (jaccardSimilarity > 0.1) {
          await this.storeSimilarity(pageId1, pageId2, jaccardSimilarity, 'tag-based');
        }
      }
    }
  }
}
```

### Step 3: Graph Analytics Computation

**PageRank Algorithm:**

```typescript
// GraphService.calculatePageRank()
static async calculatePageRank(workspaceId: string, iterations: number = 20): Promise<void> {

  // Get all pages and links in workspace
  const { data: pages } = await supabase
    .from('pages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false);

  const { data: links } = await supabase
    .from('page_links')
    .select('source_page_id, target_page_id')
    .in('source_page_id', pages?.map(p => p.id) || []);

  if (!pages || pages.length === 0) return;

  // Initialize PageRank scores
  const pageRankScores = new Map<string, number>();
  const dampingFactor = 0.85;
  const initialScore = 1.0 / pages.length;

  for (const page of pages) {
    pageRankScores.set(page.id, initialScore);
  }

  // Build adjacency lists
  const outLinks = new Map<string, string[]>();
  const inLinks = new Map<string, string[]>();

  for (const page of pages) {
    outLinks.set(page.id, []);
    inLinks.set(page.id, []);
  }

  for (const link of links || []) {
    outLinks.get(link.source_page_id)?.push(link.target_page_id);
    inLinks.get(link.target_page_id)?.push(link.source_page_id);
  }

  // Iterative PageRank calculation
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Map<string, number>();

    for (const page of pages) {
      const pageId = page.id;
      let score = (1 - dampingFactor) / pages.length;

      const incomingLinks = inLinks.get(pageId) || [];
      for (const sourcePageId of incomingLinks) {
        const sourceScore = pageRankScores.get(sourcePageId) || 0;
        const sourceOutDegree = outLinks.get(sourcePageId)?.length || 1;
        score += dampingFactor * (sourceScore / sourceOutDegree);
      }

      newScores.set(pageId, score);
    }

    // Update scores
    for (const [pageId, score] of newScores) {
      pageRankScores.set(pageId, score);
    }
  }

  // Store results in database
  for (const [pageId, score] of pageRankScores) {
    await supabase
      .from('graph_analytics')
      .upsert({
        workspace_id: workspaceId,
        page_id: pageId,
        pagerank_score: score,
        calculated_at: new Date().toISOString()
      });
  }
}
```

**Community Detection:**

```typescript
// GraphService.detectCommunities()
static async detectCommunities(workspaceId: string): Promise<void> {

  // Get similarity data for community detection
  const { data: similarities } = await supabase
    .from('page_similarities')
    .select('page1_id, page2_id, similarity_score')
    .gte('similarity_score', 0.4); // Only strong similarities

  const { data: pages } = await supabase
    .from('pages')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false);

  if (!pages || !similarities) return;

  // Build similarity graph
  const graph = new Map<string, Map<string, number>>();

  for (const page of pages) {
    graph.set(page.id, new Map());
  }

  for (const sim of similarities) {
    graph.get(sim.page1_id)?.set(sim.page2_id, sim.similarity_score);
    graph.get(sim.page2_id)?.set(sim.page1_id, sim.similarity_score);
  }

  // Simple community detection using connected components with similarity threshold
  const visited = new Set<string>();
  const communities = new Map<string, number>();
  let communityId = 0;

  const dfs = (pageId: string, currentCommunityId: number) => {
    if (visited.has(pageId)) return;

    visited.add(pageId);
    communities.set(pageId, currentCommunityId);

    const neighbors = graph.get(pageId) || new Map();
    for (const [neighborId, similarity] of neighbors) {
      if (!visited.has(neighborId) && similarity > 0.5) {
        dfs(neighborId, currentCommunityId);
      }
    }
  };

  // Find communities
  for (const page of pages) {
    if (!visited.has(page.id)) {
      dfs(page.id, communityId++);
    }
  }

  // Store community assignments
  for (const [pageId, community] of communities) {
    await supabase
      .from('graph_analytics')
      .upsert({
        workspace_id: workspaceId,
        page_id: pageId,
        community_id: community,
        calculated_at: new Date().toISOString()
      });
  }
}
```

### Step 4: Graph Data Preparation for Frontend

**Graph Data API Endpoint:**

```typescript
// GraphController.getWorkspaceGraph()
export class GraphController {
  static async getWorkspaceGraph(req: Request, res: Response) {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    try {
      // Verify workspace access
      const hasAccess = await WorkspaceService.checkUserAccess(
        userId,
        workspaceId
      );
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get pages with analytics
      const { data: pages } = await supabase
        .from("pages")
        .select(
          `
          id, title, created_at, updated_at,
          graph_analytics(pagerank_score, centrality_score, community_id, in_degree, out_degree),
          page_tags(tags(name, color))
        `
        )
        .eq("workspace_id", workspaceId)
        .eq("is_deleted", false)
        .order("updated_at", { ascending: false });

      // Get links between pages
      const { data: links } = await supabase
        .from("page_links")
        .select("source_page_id, target_page_id, link_type, context")
        .in("source_page_id", pages?.map((p) => p.id) || []);

      // Get similarities for additional connections
      const { data: similarities } = await supabase
        .from("page_similarities")
        .select("page1_id, page2_id, similarity_score, similarity_type")
        .gte("similarity_score", 0.4)
        .in("page1_id", pages?.map((p) => p.id) || []);

      // Format data for React Flow
      const nodes = (pages || []).map((page) => ({
        id: page.id,
        type: "pageNode",
        position: { x: 0, y: 0 }, // Will be calculated by layout algorithm
        data: {
          title: page.title,
          pageRank: page.graph_analytics?.pagerank_score || 0,
          centrality: page.graph_analytics?.centrality_score || 0,
          community: page.graph_analytics?.community_id || 0,
          inDegree: page.graph_analytics?.in_degree || 0,
          outDegree: page.graph_analytics?.out_degree || 0,
          tags:
            page.page_tags?.map((pt) => ({
              name: pt.tags.name,
              color: pt.tags.color,
            })) || [],
          lastUpdated: page.updated_at,
        },
      }));

      const edges = [
        // Direct links
        ...(links || []).map((link) => ({
          id: `link-${link.source_page_id}-${link.target_page_id}`,
          source: link.source_page_id,
          target: link.target_page_id,
          type: "directLink",
          data: {
            linkType: link.link_type,
            context: link.context,
          },
        })),

        // Similarity connections
        ...(similarities || []).map((sim) => ({
          id: `sim-${sim.page1_id}-${sim.page2_id}`,
          source: sim.page1_id,
          target: sim.page2_id,
          type: "similarityLink",
          data: {
            similarity: sim.similarity_score,
            similarityType: sim.similarity_type,
          },
        })),
      ];

      res.json({
        success: true,
        graph: { nodes, edges },
        stats: {
          totalPages: nodes.length,
          totalConnections: edges.length,
          communities: new Set(nodes.map((n) => n.data.community)).size,
        },
      });
    } catch (error) {
      console.error("Graph data error:", error);
      res.status(500).json({ error: "Failed to load graph data" });
    }
  }
}
```

### Step 5: Frontend Graph Visualization

**React Flow Graph Component:**

```typescript
// KnowledgeGraph.tsx
const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ workspaceId }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Load graph data
  useEffect(() => {
    loadGraphData();
  }, [workspaceId]);

  const loadGraphData = async () => {
    setLoading(true);
    try {
      const response = await graphService.getWorkspaceGraph(workspaceId);

      // Apply layout algorithm
      const layoutedGraph = applyForceDirectedLayout(response.graph);

      setNodes(layoutedGraph.nodes);
      setEdges(layoutedGraph.edges);
    } catch (error) {
      showNotification({
        title: "Graph Load Failed",
        message: "Failed to load knowledge graph",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyForceDirectedLayout = (graph: GraphData): GraphData => {
    // Use D3 force simulation for layout
    const simulation = d3
      .forceSimulation(graph.nodes)
      .force(
        "link",
        d3
          .forceLink(graph.edges)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(400, 300))
      .force("collision", d3.forceCollide().radius(30));

    // Run simulation
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }

    // Update node positions
    const layoutedNodes = graph.nodes.map((node) => ({
      ...node,
      position: { x: node.x || 0, y: node.y || 0 },
    }));

    return { nodes: layoutedNodes, edges: graph.edges };
  };

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);

    // Highlight connected nodes
    const connectedEdges = edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id
    );

    const connectedNodeIds = new Set(
      connectedEdges.flatMap((edge) => [edge.source, edge.target])
    );

    setNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: connectedNodeIds.has(n.id) || n.id === node.id ? 1 : 0.3,
        },
      }))
    );

    setEdges((edges) =>
      edges.map((e) => ({
        ...e,
        style: {
          ...e.style,
          opacity: connectedEdges.includes(e) ? 1 : 0.1,
        },
      }))
    );
  };

  return (
    <div className="knowledge-graph-container">
      {loading ? (
        <Center h="100%">
          <Loader size="lg" />
        </Center>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={{
            pageNode: PageNode,
          }}
          edgeTypes={{
            directLink: DirectLinkEdge,
            similarityLink: SimilarityLinkEdge,
          }}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      )}

      {selectedNode && (
        <NodeDetailsPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};
```

**Custom Node Component:**

```typescript
// PageNode.tsx
const PageNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeSize = Math.max(30, Math.min(80, data.pageRank * 1000));
  const communityColor = getCommunityColor(data.community);

  return (
    <div
      className={`page-node ${selected ? "selected" : ""}`}
      style={{
        width: nodeSize,
        height: nodeSize,
        backgroundColor: communityColor,
        border: `2px solid ${selected ? "#1976d2" : "#ccc"}`,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <Text
        size="xs"
        weight="bold"
        color="white"
        align="center"
        style={{
          maxWidth: nodeSize - 10,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {data.title}
      </Text>

      {data.tags.length > 0 && (
        <div className="node-tags">
          {data.tags.slice(0, 3).map((tag, index) => (
            <Badge
              key={tag.name}
              size="xs"
              color={tag.color}
              style={{
                position: "absolute",
                top: -5 - index * 15,
                right: -5,
                fontSize: "8px",
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Step 6: Real-time Graph Updates

**Graph Update Triggers:**

```typescript
// Listen for page changes that affect graph
useEffect(() => {
  if (!workspaceId) return;

  const subscription = supabase
    .channel(`workspace-graph-${workspaceId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "page_links",
        filter: `source_page_id=in.(${nodes.map((n) => n.id).join(",")})`,
      },
      (payload) => {
        console.log("Graph link change detected:", payload);
        // Refresh graph data
        loadGraphData();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "pages",
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload) => {
        console.log("Page update detected:", payload);
        // Update node data without full refresh
        updateNodeData(payload.new);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [workspaceId, nodes]);
```

## Key Packages Used

**Backend:**

- `@supabase/supabase-js`: Database operations and real-time subscriptions
- `d3-force`: Force-directed layout algorithms
- `lodash`: Utility functions for graph algorithms

**Frontend:**

- `reactflow`: Graph visualization and interaction
- `d3-force`: Layout calculation
- `@mantine/core`: UI components for graph controls
- `react`: Core framework for graph components

## Performance Optimizations

**Graph Computation:**

- Incremental PageRank updates for changed pages only
- Similarity calculation batching and caching
- Community detection optimization for large graphs

**Visualization:**

- Node virtualization for large graphs (>1000 nodes)
- Edge bundling for dense connections
- Level-of-detail rendering based on zoom level

**Database Operations:**

- Indexes on graph analytics tables
- Materialized views for complex graph queries
- Batch operations for similarity calculations
