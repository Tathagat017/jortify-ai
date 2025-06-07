import React, { useEffect, useMemo } from "react";
import { Modal, Box, Text, Loader, Alert, Group } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStore } from "../../hooks/use-store";
import { GraphNode, GraphEdge } from "../../stores/graph-view-store";

// Custom node component for better styling
const CustomNode = ({
  data,
}: {
  data: { label: string; type: string; connectionCount?: number };
}) => {
  const isHub = data.type === "hub";
  const isSource = data.type === "source";
  const isTarget = data.type === "target";
  const isIsolated = data.type === "isolated";

  const getBorderColor = () => {
    if (isHub) return "#e03131";
    if (isSource) return "#2f9e44";
    if (isTarget) return "#1971c2";
    if (isIsolated) return "#868e96";
    return "#e9ecef";
  };

  const getBackgroundColor = () => {
    if (isHub) return "#ffe3e3";
    if (isSource) return "#ebfbee";
    if (isTarget) return "#e7f5ff";
    if (isIsolated) return "#f8f9fa";
    return "#ffffff";
  };

  const getTypeLabel = () => {
    if (isHub) return "Hub";
    if (isSource) return "Source";
    if (isTarget) return "Target";
    if (isIsolated) return "Isolated";
    return "";
  };

  return (
    <Box
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        border: `2px solid ${getBorderColor()}`,
        backgroundColor: getBackgroundColor(),
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        minWidth: "120px",
        textAlign: "center",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {/* Add handles for connecting edges */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: getBorderColor(),
          width: "8px",
          height: "8px",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: getBorderColor(),
          width: "8px",
          height: "8px",
        }}
      />

      <Text size="sm" weight={isHub ? 600 : 500}>
        {data.label}
      </Text>
      <Text size="xs" color="dimmed">
        {getTypeLabel()}
        {data.connectionCount !== undefined &&
          ` • ${data.connectionCount} links`}
      </Text>
    </Box>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

const KnowledgeGraphModal: React.FC = observer(() => {
  const { graphViewStore, pageStore } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Convert graph data to React Flow format
  const reactFlowData = useMemo(() => {
    if (!graphViewStore.currentGraph) return { nodes: [], edges: [] };

    console.log("🔍 Processing graph data:", {
      nodeCount: graphViewStore.currentGraph.nodes.length,
      edgeCount: graphViewStore.currentGraph.edges.length,
      edges: graphViewStore.currentGraph.edges,
    });

    const flowNodes: Node[] = graphViewStore.currentGraph.nodes.map(
      (node: GraphNode) => ({
        id: node.id,
        type: "custom",
        position: { x: node.x, y: node.y },
        data: {
          label: node.label,
          type: node.type,
          connectionCount: node.connectionCount,
        },
        draggable: true,
      })
    );

    const flowEdges: Edge[] = graphViewStore.currentGraph.edges.map(
      (edge: GraphEdge) => {
        
        console.log(
          "🔍 Edge source exists in nodes:",
          flowNodes.some((n) => n.id === edge.source)
        );
        console.log(
          "🔍 Edge target exists in nodes:",
          flowNodes.some((n) => n.id === edge.target)
        );

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          animated: true,
          style: {
            strokeWidth: 3,
            stroke: "#2f9e44",
          },
          label: "linked",
          labelStyle: {
            fontSize: "12px",
            fill: "#2f9e44",
            fontWeight: "600",
          },
        };
      }
    );

    console.log("✅ Generated React Flow data:", {
      nodes: flowNodes.length,
      edges: flowEdges.length,
      edgeDetails: flowEdges,
      nodeIds: flowNodes.map((n) => n.id),
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graphViewStore.currentGraph]);

  // Update React Flow nodes and edges when graph data changes
  useEffect(() => {
    setNodes(reactFlowData.nodes);
    setEdges(reactFlowData.edges);
  }, [reactFlowData, setNodes, setEdges]);

  // Fetch graph data when modal opens
  useEffect(() => {
    if (graphViewStore.isModalOpen && pageStore.selectedPage) {
      const workspaceId = pageStore.selectedPage.workspace_id;
      if (workspaceId) {
        graphViewStore.fetchKnowledgeGraph(workspaceId);
      }
    }
  }, [graphViewStore.isModalOpen, pageStore.selectedPage, graphViewStore]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    // Navigate to the clicked page
    if (node.id !== pageStore.selectedPage?.id) {
      pageStore.selectPageFromUrl(node.id);
      graphViewStore.closeModal();
    }
  };

  return (
    <Modal
      opened={graphViewStore.isModalOpen}
      onClose={graphViewStore.closeModal}
      title="Knowledge Graph - Linked Pages"
      size="xl"
      centered
    >
      <Box style={{ height: "500px", width: "100%" }}>
        {graphViewStore.isLoading && (
          <Box
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <Group>
              <Loader size="sm" />
              <Text>Loading knowledge graph...</Text>
            </Group>
          </Box>
        )}

        {graphViewStore.error && (
          <Alert
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            title="Error"
            color="red"
          >
            {graphViewStore.error}
          </Alert>
        )}

        {!graphViewStore.isLoading &&
          !graphViewStore.error &&
          graphViewStore.currentGraph && (
            <>
              {graphViewStore.currentGraph.nodes.length === 0 ? (
                <Box
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <Text color="dimmed">
                    No related pages found in this workspace.
                  </Text>
                </Box>
              ) : (
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={handleNodeClick}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                >
                  <Controls />
                  <Background color="#f1f5f9" gap={16} />

                  {/* Legend */}
                  <Box
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      padding: "8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      zIndex: 1000,
                    }}
                  >
                    <Text
                      size="xs"
                      weight={600}
                      style={{ marginBottom: "4px" }}
                    >
                      Legend
                    </Text>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #e03131",
                            backgroundColor: "#ffe3e3",
                            borderRadius: "2px",
                          }}
                        />
                        <Text size="xs">Hub Pages</Text>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #2f9e44",
                            backgroundColor: "#ebfbee",
                            borderRadius: "2px",
                          }}
                        />
                        <Text size="xs">Source Pages</Text>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #1971c2",
                            backgroundColor: "#e7f5ff",
                            borderRadius: "2px",
                          }}
                        />
                        <Text size="xs">Target Pages</Text>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            width: "12px",
                            height: "12px",
                            border: "2px solid #868e96",
                            backgroundColor: "#f8f9fa",
                            borderRadius: "2px",
                          }}
                        />
                        <Text size="xs">Isolated Pages</Text>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            width: "16px",
                            height: "2px",
                            backgroundColor: "#2f9e44",
                          }}
                        />
                        <Text size="xs">Page Link</Text>
                      </div>
                    </div>
                  </Box>
                </ReactFlow>
              )}
            </>
          )}
      </Box>
    </Modal>
  );
});

export default KnowledgeGraphModal;
