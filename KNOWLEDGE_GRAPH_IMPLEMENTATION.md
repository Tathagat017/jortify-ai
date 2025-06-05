# 🧠 Knowledge Graph Implementation

## Overview

The Knowledge Graph feature provides a visual representation of page relationships within a workspace. This implementation uses React Flow for visualization and AI-generated relationship mapping.

## Features Implemented

### ✅ Backend API

- **Endpoint**: `GET /ai/graph/:pageId`
- **Functionality**: Generates a graph structure showing relationships between pages in the same workspace
- **Demo Implementation**: Creates circular layout with random similarity scores for demonstration

### ✅ Frontend Components

- **KnowledgeGraphModal**: React Flow-based modal for graph visualization
- **GraphViewStore**: MobX store for managing graph state and API calls
- **TitleBar Integration**: Code-merge icon replaces favorite star icon

### ✅ User Experience

- Click the code-merge icon (🔀) in the title bar to open the knowledge graph
- Interactive nodes that can be clicked to navigate to different pages
- Visual distinction between current page (blue border) and related pages
- Similarity scores displayed on related page nodes
- Responsive modal with loading states and error handling

## Technical Implementation

### Backend (`backend/src/controllers/ai.controller.ts`)

```typescript
static async getKnowledgeGraph(req: Request, res: Response) {
  // Validates page exists and user has access
  // Fetches all pages in the same workspace
  // Creates circular layout with similarity scores
  // Returns nodes and edges in React Flow format
}
```

### Frontend Store (`frontend/src/stores/graph-view-store.ts`)

```typescript
export class GraphViewStore {
  isModalOpen: boolean;
  isLoading: boolean;
  error: string | null;
  currentGraph: KnowledgeGraph | null;

  openModal();
  closeModal();
  fetchKnowledgeGraph(pageId: string);
}
```

### React Flow Component (`frontend/src/components/graph/KnowledgeGraphModal.tsx`)

- Custom node styling with similarity indicators
- Interactive navigation between pages
- Responsive layout with controls and background
- Error handling and loading states

## Usage

1. **Open Knowledge Graph**: Click the code-merge icon (🔀) in the title bar
2. **Explore Relationships**: View how the current page relates to other pages in the workspace
3. **Navigate**: Click on any node to navigate to that page
4. **Close**: Click outside the modal or use the close button

## Demo Features

For demonstration purposes, the current implementation:

- Shows up to 10 related pages in a circular layout
- Generates random similarity scores (50-100%)
- Creates edges between the current page and all related pages
- Uses page creation order for relationship determination

## Future Enhancements

The current implementation provides a solid foundation for:

- AI-powered semantic relationship analysis
- Content-based similarity scoring
- Hierarchical page relationship mapping
- Advanced graph layouts (force-directed, hierarchical)
- Filtering and search within the graph
- Export functionality for graph data

## Files Modified/Created

### Backend

- `backend/src/routes/ai.routes.ts` - Added graph endpoint
- `backend/src/controllers/ai.controller.ts` - Added getKnowledgeGraph method

### Frontend

- `frontend/src/services/ai.service.ts` - Added getKnowledgeGraph API call
- `frontend/src/stores/graph-view-store.ts` - Complete store implementation
- `frontend/src/components/graph/KnowledgeGraphModal.tsx` - New component
- `frontend/src/components/graph/index.ts` - Export file
- `frontend/src/components/editor/TitleBar.tsx` - Added graph icon and modal

## Dependencies Used

- **react-flow-renderer**: Already installed for graph visualization
- **@mantine/core**: For modal and UI components
- **@fortawesome/react-fontawesome**: For the code-merge icon
- **mobx-react-lite**: For reactive state management

The implementation is minimal, focused, and doesn't break existing functionality while providing a solid foundation for future AI-powered enhancements.
