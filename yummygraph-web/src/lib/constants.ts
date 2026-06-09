import type { NodeLabel } from 'yummygraph-shared';

// Node colors by type — harmonized to the Phosphor Terminal accent family
// (phosphor green + the design's panel accents: blue, cyan, pink, purple, amber, orange)
export const NODE_COLORS: Record<NodeLabel, string> = {
  Project: '#aa88ff', // Accent-purple - prominent container
  Package: '#9d7bff', // Purple - structural
  Module: '#8b6aff', // Deep purple - container
  Folder: '#00aaff', // Accent-blue
  File: '#00ccff', // Bright cyan-blue
  Class: '#ffb300', // Amber - stands out
  Function: '#00ff88', // Phosphor green - the hero element
  Method: '#00ffaa', // Accent-cyan
  Variable: '#7a9e8a', // Muted green (text-2) - less important
  Interface: '#ff79c6', // Accent-pink
  Enum: '#ff6644', // Accent-orange
  Decorator: '#ffd166', // Light amber - modifier
  Import: '#3a5a48', // Text-3 - very muted
  Type: '#c4a8ff', // Light purple
  CodeElement: '#7a9e8a', // Muted green
  Community: '#88c0ff', // Soft blue - cluster indicator
  Process: '#ff4444', // Red - execution flow indicator
  Section: '#00aaff', // Accent-blue - structural section
  Struct: '#ffb300', // Amber - like Class
  Trait: '#ff79c6', // Pink - like Interface
  Impl: '#00ffaa', // Cyan - like Method
  TypeAlias: '#c4a8ff', // Light purple - like Type
  Const: '#7a9e8a', // Muted - like Variable
  Static: '#7a9e8a', // Muted - like Variable
  Namespace: '#8b6aff', // Deep purple - like Module
  Union: '#ff6644', // Orange - like Enum
  Typedef: '#c4a8ff', // Light purple - like Type
  Macro: '#ffd166', // Light amber - like Decorator
  Property: '#7a9e8a', // Muted - like Variable
  Record: '#ffb300', // Amber - like Class
  Delegate: '#00ffaa', // Cyan - like Method
  Annotation: '#ffd166', // Light amber - like Decorator
  Constructor: '#00ff88', // Phosphor green - like Function
  Template: '#c4a8ff', // Light purple - like Type
  Route: '#ff4444', // Red - like Process
  Tool: '#aa88ff', // Accent-purple - like Project
};

// Node sizes by type - clear visual hierarchy with dramatic size differences
// Structural nodes are MUCH larger to make hierarchy obvious
export const NODE_SIZES: Record<NodeLabel, number> = {
  Project: 20, // Largest - root of everything
  Package: 16, // Major structural element
  Module: 13, // Important container
  Folder: 10, // Structural - clearly bigger than files
  File: 6, // Common element - smaller than folders
  Class: 8, // Important code structure
  Function: 4, // Common code element - small
  Method: 3, // Smaller than function
  Variable: 2, // Tiny - leaf node
  Interface: 7, // Important type definition
  Enum: 5, // Type definition
  Decorator: 2, // Tiny modifier
  Import: 1.5, // Very small - usually hidden anyway
  Type: 3, // Type alias - small
  CodeElement: 2, // Generic small
  Community: 0, // Hidden by default - metadata node
  Process: 0, // Hidden by default - metadata node
  Section: 8, // Structural section - similar to Folder
  Struct: 8, // Like Class
  Trait: 7, // Like Interface
  Impl: 3, // Like Method
  TypeAlias: 3, // Like Type
  Const: 2, // Like Variable
  Static: 2, // Like Variable
  Namespace: 13, // Like Module
  Union: 5, // Like Enum
  Typedef: 3, // Like Type
  Macro: 2, // Like Decorator
  Property: 2, // Like Variable
  Record: 8, // Like Class
  Delegate: 3, // Like Method
  Annotation: 2, // Like Decorator
  Constructor: 4, // Like Function
  Template: 3, // Like Type
  Route: 5, // Like Enum
  Tool: 5, // Like Enum
};

// Community color palette for cluster-based coloring
export const COMMUNITY_COLORS = [
  '#00ff88', // phosphor green
  '#00ffaa', // cyan
  '#00aaff', // blue
  '#aa88ff', // purple
  '#ff79c6', // pink
  '#ffb300', // amber
  '#ff6644', // orange
  '#00cc66', // dim green
  '#88c0ff', // soft blue
  '#c4a8ff', // light purple
  '#ffd166', // light amber
  '#ff4444', // red
];

export const getCommunityColor = (communityIndex: number): string => {
  return COMMUNITY_COLORS[communityIndex % COMMUNITY_COLORS.length];
};

// Labels to show by default (hide imports by default as they clutter).
// Property/Const are the Kotlin/Java equivalents of Variable — include them so
// Kotlin repos don't appear to have no leaf nodes.
export const DEFAULT_VISIBLE_LABELS: NodeLabel[] = [
  'Project',
  'Package',
  'Module',
  'Folder',
  'File',
  'Class',
  'Function',
  'Method',
  'Property', // Kotlin/Java fields (HAS_PROPERTY + DEFINES File→Property)
  'Const', // Top-level constants
  'Interface',
  'Enum',
  'Type',
];

// All filterable labels (in display order)
export const FILTERABLE_LABELS: NodeLabel[] = [
  'Folder',
  'File',
  'Class',
  'Interface',
  'Enum',
  'Type',
  'Function',
  'Method',
  'Variable',
  'Property', // Kotlin/Java field nodes
  'Const',
  'Decorator',
  'Import',
];

// Quick-filter preset label sets (for the Filters tab preset buttons).
export const CODE_SYMBOL_LABELS: NodeLabel[] = [
  'Class',
  'Interface',
  'Enum',
  'Type',
  'Function',
  'Method',
];
export const STRUCTURE_LABELS: NodeLabel[] = ['Project', 'Package', 'Module', 'Folder', 'File'];
// "Noise" leaf kinds that dominate node counts and clutter the graph.
export const NOISE_LABELS: NodeLabel[] = ['Property', 'Variable', 'Const', 'Decorator', 'Import'];
// Full toggleable + structural set — used by the "All" button.
export const ALL_VISIBLE_LABELS: NodeLabel[] = ['Project', 'Package', 'Module', ...FILTERABLE_LABELS];

export const LABEL_PRESETS: { id: string; label: string; labels: NodeLabel[] }[] = [
  { id: 'code', label: 'Code only', labels: CODE_SYMBOL_LABELS },
  { id: 'hideNoise', label: 'Hide noise', labels: ALL_VISIBLE_LABELS.filter((l) => !NOISE_LABELS.includes(l)) },
  { id: 'structure', label: 'Structure', labels: STRUCTURE_LABELS },
];

// Edge/Relation types
export type EdgeType = 'CONTAINS' | 'DEFINES' | 'IMPORTS' | 'CALLS' | 'EXTENDS' | 'IMPLEMENTS';

export const ALL_EDGE_TYPES: EdgeType[] = [
  'CONTAINS',
  'DEFINES',
  'IMPORTS',
  'CALLS',
  'EXTENDS',
  'IMPLEMENTS',
];

// Default visible edges (CALLS hidden by default to reduce clutter)
export const DEFAULT_VISIBLE_EDGES: EdgeType[] = [
  'CONTAINS',
  'DEFINES',
  'IMPORTS',
  'EXTENDS',
  'IMPLEMENTS',
  'CALLS',
];

// Edge display info for UI
export const EDGE_INFO: Record<EdgeType, { color: string; label: string }> = {
  CONTAINS: { color: '#2d5a3d', label: 'Contains' },
  DEFINES: { color: '#0a8a7a', label: 'Defines' }, // dim cyan
  IMPORTS: { color: '#2a6fb0', label: 'Imports' }, // dim blue
  CALLS: { color: '#00cc66', label: 'Calls' }, // primary-dim green
  EXTENDS: { color: '#cc8800', label: 'Extends' }, // amber-dim
  IMPLEMENTS: { color: '#bb4d88', label: 'Implements' }, // dim pink
};
