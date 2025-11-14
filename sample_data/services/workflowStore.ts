/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import {
  WorkflowNode as WorkflowNodeInterface,
  WorkflowEdge as WorkflowEdgeInterface,
  LLMModel,
  Tool,
  AgentRole,
} from '../../types';

// ----------------------------------------
// 1. Type Definitions
// ----------------------------------------
export type ComponentId = string;
export interface Point { x: number; y: number; }
export type WorkflowNode = WorkflowNodeInterface;
export type WorkflowEdge = WorkflowEdgeInterface;



export type ConnectingEdge = {
  source: ComponentId;
  position: Point;
} | null;

export interface WorkflowLog {
  id: string;
  componentId: string;
  componentType: 'node' | 'llm' | 'tool' | 'data' | 'workflow';
  timestamp: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message: string;
  actualContent?: any;
}

export type NodeRuntimeStatus = 'idle' | 'running' | 'success' | 'error';


// ----------------------------------------
// 2. Store State & Actions Interfaces
// ----------------------------------------
interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  tools: Tool[];
  llms: LLMModel[];
  selectedComponentId: ComponentId | null;
  workflowName: string;
  workflowId: ComponentId;
  isDefaultWorkflow: boolean;
  nodeRuntimeStatus: Record<string, NodeRuntimeStatus>;
  connectingEdge: ConnectingEdge;
}

interface WorkflowActions {
  setWorkflow: (workflow: Omit<WorkflowState, 'connectingEdge'>) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNodePosition: (id: ComponentId, position: Point) => void;
  updateNodeProps: (id: ComponentId, updates: Partial<WorkflowNode>) => void;
  deleteNode: (id: ComponentId) => void;
  addEdge: (edge: WorkflowEdge) => void;
  deleteEdge: (id: ComponentId) => void;
  selectComponent: (id: ComponentId | null) => void;
  setWorkflowName: (name: string) => void;
  addTool: (tool: Tool) => void;
  updateTool: (id: ComponentId, updates: Partial<Tool>) => void;
  deleteTool: (id: ComponentId) => void;
  addLlm: (llm: LLMModel) => void;
  updateLlm: (id: ComponentId, updates: Partial<LLMModel>) => void;
  deleteLlm: (id: ComponentId) => void;
  addNodeAndSelect: (node: WorkflowNode) => void;
  setConnectingEdge: (edge: ConnectingEdge) => void;
  setNodeStatus: (id: ComponentId, status: NodeRuntimeStatus) => void;
  resetAllNodeStatus: () => void;
}

// ----------------------------------------
// 3. Store Implementation
// ----------------------------------------
const initialState: WorkflowState = {
  nodes: [],
  edges: [],
  tools: [],
  llms: [],
  selectedComponentId: null,
  workflowName: '新工作流',
  workflowId: crypto.randomUUID(),
  isDefaultWorkflow: false,
  connectingEdge: null,
  nodeRuntimeStatus: {},
};

export const useWorkflowStore = create<WorkflowState & WorkflowActions>((set) => ({
  ...initialState,

  setWorkflow: (payload) => set({ ...payload, selectedComponentId: null, connectingEdge: null }),
  
  setNodes: (payload) => set({ nodes: payload }),

  addNode: (payload) => set((state) => ({ nodes: [...state.nodes, payload] })),
  
  updateNodePosition: (id, position) => set((state) => ({
    nodes: state.nodes.map(node => node.id === id ? { ...node, position } : node)
  })),
  
  updateNodeProps: (id, updates) => set((state) => ({
    nodes: state.nodes.map(node => node.id === id ? { ...node, ...updates } : node)
  })),
  
  deleteNode: (id) => set((state) => ({
    nodes: state.nodes.filter(node => node.id !== id),
    edges: state.edges.filter(edge => edge.source !== id && edge.target !== id),
    selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId
  })),
  
  addEdge: (payload) => set((state) => ({ edges: [...state.edges, payload] })),
  
  deleteEdge: (id) => set((state) => ({
    edges: state.edges.filter(edge => edge.id !== id),
    selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId
  })),
  
  selectComponent: (id) => set({ selectedComponentId: id }),
  
  setWorkflowName: (name) => set({ workflowName: name }),
  
  addTool: (payload) => set((state) => ({ tools: [...state.tools, payload] })),
  
  updateTool: (id, updates) => set((state) => ({
    tools: state.tools.map(tool => tool.id === id ? { ...tool, ...updates } : tool)
  })),
  
  deleteTool: (id) => set((state) => ({
    tools: state.tools.filter(tool => tool.id !== id),
    selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId
  })),
  
  addLlm: (payload) => set((state) => ({ llms: [...state.llms, payload] })),
  
  updateLlm: (id, updates) => set((state) => ({
    llms: state.llms.map(llm => llm.id === id ? { ...llm, ...updates } : llm)
  })),
  
  deleteLlm: (id) => set((state) => ({
    llms: state.llms.filter(llm => llm.id !== id),
    selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId
  })),
  
  addNodeAndSelect: (payload) => set((state) => ({
    nodes: [...state.nodes, payload],
    selectedComponentId: payload.id
  })),
  
  setConnectingEdge: (edge) => set({ connectingEdge: edge }),
  
  setNodeStatus: (id, status) => set((state) => ({
    nodeRuntimeStatus: { ...state.nodeRuntimeStatus, [id]: status }
  })),
  
  resetAllNodeStatus: () => set({ nodeRuntimeStatus: {} }),
}));