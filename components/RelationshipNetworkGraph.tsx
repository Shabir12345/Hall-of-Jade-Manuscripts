/**
 * Relationship Network Graph Component
 * Interactive force-directed visualization of character relationships using SVG
 * Features: force-directed layout, zoom/pan, drag nodes, filtering, enhanced tooltips
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Character, Relationship } from '../types';
import { getRelationshipStrength } from '../services/relationshipService';

interface RelationshipNetworkGraphProps {
  characters: Character[];
  selectedCharacterId?: string;
  onCharacterClick?: (characterId: string) => void;
  width?: number;
  height?: number;
}

interface Node {
  id: string;
  character: Character;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: Node;
  target: Node;
  relationship: Relationship;
  strength: number;
}

interface FilterState {
  relationshipTypes: Set<string>;
  showIsolated: boolean;
  highlightCharacterId?: string;
}

export const RelationshipNetworkGraph: React.FC<RelationshipNetworkGraphProps> = ({
  characters,
  selectedCharacterId,
  onCharacterClick,
  width = 800,
  height = 600,
}) => {
  const [dimensions, setDimensions] = useState({ width, height });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<{ source: string; target: string } | null>(null);
  const [selectedLink, setSelectedLink] = useState<{ source: string; target: string } | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [filterState, setFilterState] = useState<FilterState>({
    relationshipTypes: new Set(),
    showIsolated: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    type: 'node' | 'link';
    node?: Character;
    link?: { source: Character; target: Character; relationship: Relationship; strength: number };
    x: number;
    y: number;
  } | null>(null);

  // Calculate graph data with filtering
  const { nodes, links, allRelationshipTypes } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const linkSet = new Set<string>();
    const linkList: Link[] = [];
    const relationshipTypes = new Set<string>();

    // Initialize nodes
    characters.forEach((char, index) => {
      const angle = (2 * Math.PI * index) / Math.max(characters.length, 1);
      const radius = Math.min(dimensions.width, dimensions.height) * 0.25;
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;

      nodeMap.set(char.id, {
        id: char.id,
        character: char,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    // Create links from relationships
    characters.forEach(char => {
      if (char.relationships) {
        char.relationships.forEach(rel => {
          const linkKey = [char.id, rel.characterId].sort().join('-');
          if (!linkSet.has(linkKey) && nodeMap.has(rel.characterId)) {
            linkSet.add(linkKey);
            const strength = getRelationshipStrength(rel);
            relationshipTypes.add(rel.type);
            
            const sourceNode = nodeMap.get(char.id)!;
            const targetNode = nodeMap.get(rel.characterId)!;
            
            linkList.push({
              source: sourceNode,
              target: targetNode,
              relationship: rel,
              strength,
            });
          }
        });
      }
    });

    // Filter links by relationship type
    const filteredLinks = filterState.relationshipTypes.size > 0
      ? linkList.filter(link => filterState.relationshipTypes.has(link.relationship.type))
      : linkList;

    // Filter nodes by isolated status
    const nodesWithLinks = new Set<string>();
    filteredLinks.forEach(link => {
      nodesWithLinks.add(link.source.id);
      nodesWithLinks.add(link.target.id);
    });

    const filteredNodes = filterState.showIsolated
      ? Array.from(nodeMap.values())
      : Array.from(nodeMap.values()).filter(node => nodesWithLinks.has(node.id));

    return {
      nodes: filteredNodes,
      links: filteredLinks,
      allRelationshipTypes: Array.from(relationshipTypes),
    };
  }, [characters, dimensions, filterState]);

  // Force-directed simulation
  const nodesRef = useRef<Node[]>(nodes);
  const linksRef = useRef<Link[]>(links);
  const simulationRef = useRef<{
    alpha: number;
    alphaTarget: number;
    alphaDecay: number;
    velocityDecay: number;
    running: boolean;
  }>({
    alpha: 1,
    alphaTarget: 0,
    alphaDecay: 0.0228,
    velocityDecay: 0.4,
    running: false,
  });

  useEffect(() => {
    nodesRef.current = nodes;
    linksRef.current = links;
    
    // Reset simulation
    simulationRef.current.alpha = 1;
    simulationRef.current.running = true;
    
    // Reset node velocities
    nodesRef.current.forEach(node => {
      node.vx = 0;
      node.vy = 0;
      if (!draggedNode || node.id !== draggedNode) {
        node.fx = null;
        node.fy = null;
      }
    });

    const animate = () => {
      const sim = simulationRef.current;
      if (!sim.running || sim.alpha < 0.001) {
        sim.running = false;
        return;
      }

      const currentNodes = nodesRef.current;
      const currentLinks = linksRef.current;

      // Apply forces
      applyForces(currentNodes, currentLinks);

      // Update alpha
      sim.alpha += (sim.alphaTarget - sim.alpha) * sim.alphaDecay;

      // Trigger re-render
      setDimensions(prev => ({ ...prev }));

      if (sim.running) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nodes.length, links.length, draggedNode]);

  // Force simulation functions
  const applyForces = (nodes: Node[], links: Link[]) => {
    const sim = simulationRef.current;
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // Link force (distance based on relationship strength)
    const linkDistance = 100;
    links.forEach(link => {
      const source = link.source;
      const target = link.target;
      const distance = Math.sqrt((target.x - source.x) ** 2 + (target.y - source.y) ** 2);
      const strength = link.strength / 100; // Normalize to 0-1
      const targetDistance = linkDistance * (2 - strength); // Stronger relationships = closer

      if (distance > 0) {
        const x = target.x - source.x;
        const y = target.y - source.y;
        const l = Math.sqrt(x * x + y * y);
        const factor = ((l - targetDistance) / l) * sim.alpha * 0.1;

        if (!draggedNode || draggedNode !== source.id) {
          source.vx += x * factor;
          source.vy += y * factor;
        }
        if (!draggedNode || draggedNode !== target.id) {
          target.vx -= x * factor;
          target.vy -= y * factor;
        }
      }
    });

    // Charge force (repulsion between nodes)
    const chargeStrength = -300;
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      if (draggedNode && nodeA.id === draggedNode) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        if (draggedNode && nodeB.id === draggedNode) continue;

        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const force = (chargeStrength * sim.alpha) / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          nodeA.vx += fx;
          nodeA.vy += fy;
          nodeB.vx -= fx;
          nodeB.vy -= fy;
        }
      }
    }

    // Center force
    const centerStrength = 0.1;
    nodes.forEach(node => {
      if (draggedNode && node.id === draggedNode) return;
      node.vx += (centerX - node.x) * centerStrength * sim.alpha;
      node.vy += (centerY - node.y) * centerStrength * sim.alpha;
    });

    // Update positions
    nodes.forEach(node => {
      if (draggedNode && node.id === draggedNode) return;

      node.vx *= simulationRef.current.velocityDecay;
      node.vy *= simulationRef.current.velocityDecay;
      node.x += node.vx;
      node.y += node.vy;

      // Boundary constraints
      const padding = 50;
      if (node.x < padding) { node.x = padding; node.vx = 0; }
      if (node.x > dimensions.width - padding) { node.x = dimensions.width - padding; node.vx = 0; }
      if (node.y < padding) { node.y = padding; node.vy = 0; }
      if (node.y > dimensions.height - padding) { node.y = dimensions.height - padding; node.vy = 0; }
    });
  };

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width || width, height: rect.height || height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // Handle node drag
  const handleNodeMouseDown = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDraggedNode(nodeId);
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  const handleNodeMouseMove = useCallback((event: React.MouseEvent) => {
    if (draggedNode) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        const node = nodesRef.current.find(n => n.id === draggedNode);
        if (node) {
          const x = (event.clientX - rect.left - pan.x) / zoom;
          const y = (event.clientY - rect.top - pan.y) / zoom;
          node.fx = Math.max(50, Math.min(dimensions.width - 50, x));
          node.fy = Math.max(50, Math.min(dimensions.height - 50, y));
          node.x = node.fx;
          node.y = node.fy;
          setDimensions(prev => ({ ...prev }));
        }
      }
    }
  }, [draggedNode, pan, zoom, dimensions]);

  const handleNodeMouseUp = useCallback(() => {
    if (draggedNode) {
      const node = nodesRef.current.find(n => n.id === draggedNode);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
      setDraggedNode(null);
      // Restart simulation
      simulationRef.current.alpha = 0.3;
      simulationRef.current.running = true;
      if (!animationFrameRef.current) {
        animationFrameRef.current = requestAnimationFrame(() => {
          const animate = () => {
            applyForces(nodesRef.current, linksRef.current);
            setDimensions(prev => ({ ...prev }));
            if (simulationRef.current.running && simulationRef.current.alpha > 0.001) {
              animationFrameRef.current = requestAnimationFrame(animate);
            } else {
              simulationRef.current.running = false;
            }
          };
          animate();
        });
      }
    }
  }, [draggedNode]);

  // Handle pan
  const handlePanStart = useCallback((event: React.MouseEvent) => {
    if (event.button === 0 && !draggedNode) { // Left mouse button
      setIsPanning(true);
      setPanStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
    }
  }, [pan, draggedNode]);

  const handlePanMove = useCallback((event: React.MouseEvent) => {
    if (isPanning && !draggedNode) {
      setPan({ x: event.clientX - panStart.x, y: event.clientY - panStart.y });
    }
  }, [isPanning, panStart, draggedNode]);

  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (onCharacterClick) {
      onCharacterClick(nodeId);
    }
  }, [onCharacterClick]);

  // Get relationship type color
  const getRelationshipColor = (type: string): string => {
    const normalized = type.toLowerCase();
    if (normalized.includes('enemy') || normalized.includes('rival')) {
      return '#ef4444'; // red
    } else if (normalized.includes('ally') || normalized.includes('friend')) {
      return '#10b981'; // green
    } else if (normalized.includes('mentor') || normalized.includes('master')) {
      return '#3b82f6'; // blue
    } else if (normalized.includes('lover') || normalized.includes('spouse')) {
      return '#ec4899'; // pink
    } else if (normalized.includes('family')) {
      return '#8b5cf6'; // purple
    }
    return '#6b7280'; // gray (default)
  };

  // Get node color based on character
  const getNodeColor = (character: Character): string => {
    if (character.id === selectedCharacterId) {
      return '#f59e0b'; // amber (selected)
    }
    if (filterState.highlightCharacterId === character.id) {
      return '#fbbf24'; // light amber (highlighted)
    }
    if (character.isProtagonist) {
      return '#eab308'; // yellow (protagonist)
    }
    return '#6366f1'; // indigo (default)
  };

  // Toggle relationship type filter
  const toggleRelationshipTypeFilter = useCallback((type: string) => {
    setFilterState(prev => {
      const newTypes = new Set(prev.relationshipTypes);
      if (newTypes.has(type)) {
        newTypes.delete(type);
      } else {
        newTypes.add(type);
      }
      return { ...prev, relationshipTypes: newTypes };
    });
  }, []);

  // Highlight character connections
  const handleHighlightCharacter = useCallback((characterId?: string) => {
    setFilterState(prev => ({ ...prev, highlightCharacterId: characterId }));
  }, []);

  // Get highlighted nodes (character and its connections)
  const highlightedNodeIds = useMemo(() => {
    if (!filterState.highlightCharacterId) return new Set<string>();
    const highlighted = new Set<string>([filterState.highlightCharacterId]);
    links.forEach(link => {
      if (link.source.id === filterState.highlightCharacterId) {
        highlighted.add(link.target.id);
      }
      if (link.target.id === filterState.highlightCharacterId) {
        highlighted.add(link.source.id);
      }
    });
    return highlighted;
  }, [filterState.highlightCharacterId, links]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700 relative"
      onMouseMove={handleNodeMouseMove}
      onMouseUp={handleNodeMouseUp}
      onMouseLeave={handleNodeMouseUp}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors"
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold transition-colors"
        >
          Reset View
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute top-4 left-4 z-10 bg-zinc-800/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-4 space-y-3 max-w-xs">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Filters</div>
          
          <div className="space-y-2">
            <label className="text-xs text-zinc-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={filterState.showIsolated}
                onChange={(e) => setFilterState(prev => ({ ...prev, showIsolated: e.target.checked }))}
                className="rounded"
              />
              Show isolated characters
            </label>
          </div>

          {allRelationshipTypes.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-zinc-400">Relationship Types:</div>
              <div className="flex flex-wrap gap-2">
                {allRelationshipTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleRelationshipTypeFilter(type)}
                    className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                      filterState.relationshipTypes.has(type)
                        ? 'bg-amber-600/20 border-amber-600 text-amber-400'
                        : 'bg-zinc-700/50 border-zinc-600 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full h-full"
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onWheel={handleWheel}
        style={{ cursor: isPanning ? 'grabbing' : draggedNode ? 'grabbing' : 'default' }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Links (relationships) */}
          <g className="links">
            {links.map((link, index) => {
              const sourceId = link.source.id;
              const targetId = link.target.id;
              const isHighlighted = filterState.highlightCharacterId && 
                (sourceId === filterState.highlightCharacterId || targetId === filterState.highlightCharacterId);
              const isHovered = hoveredLink?.source === sourceId && hoveredLink?.target === targetId;
              const isSelected = selectedLink?.source === sourceId && selectedLink?.target === targetId;
              
              const color = getRelationshipColor(link.relationship.type);
              const opacity = isSelected ? 0.9 : isHovered ? 0.7 : isHighlighted ? 0.5 : 0.3;
              const strokeWidth = Math.max(1, link.strength / 20) * (isHighlighted || isHovered || isSelected ? 1.5 : 1);

              return (
                <line
                  key={`${sourceId}-${targetId}-${index}`}
                  x1={link.source.x}
                  y1={link.source.y}
                  x2={link.target.x}
                  y2={link.target.y}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  opacity={opacity}
                  onMouseEnter={() => {
                    setHoveredLink({ source: sourceId, target: targetId });
                    setTooltipData({
                      type: 'link',
                      link: {
                        source: link.source.character,
                        target: link.target.character,
                        relationship: link.relationship,
                        strength: link.strength,
                      },
                      x: (link.source.x + link.target.x) / 2,
                      y: (link.source.y + link.target.y) / 2,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredLink(null);
                    if (tooltipData?.type === 'link') {
                      setTooltipData(null);
                    }
                  }}
                  onClick={() => setSelectedLink({ source: sourceId, target: targetId })}
                  className="cursor-pointer transition-opacity"
                />
              );
            })}
          </g>

          {/* Nodes (characters) */}
          <g className="nodes">
            {nodes.map(node => {
              const isSelected = node.id === selectedCharacterId;
              const isHovered = hoveredNode === node.id;
              const isHighlighted = highlightedNodeIds.has(node.id);
              const isDragging = draggedNode === node.id;
              
              const color = getNodeColor(node.character);
              const radius = isSelected ? 14 : isHovered ? 12 : isHighlighted ? 11 : 10;
              const strokeWidth = isSelected ? 3 : isHovered || isHighlighted ? 2.5 : 2;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onMouseEnter={() => {
                    setHoveredNode(node.id);
                    setTooltipData({
                      type: 'node',
                      node: node.character,
                      x: node.x,
                      y: node.y,
                    });
                    handleHighlightCharacter(node.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredNode(null);
                    if (tooltipData?.type === 'node' && tooltipData.node?.id === node.id) {
                      setTooltipData(null);
                    }
                  }}
                  onClick={() => handleNodeClick(node.id)}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={color}
                    stroke={isHighlighted || isSelected ? '#fbbf24' : '#1f2937'}
                    strokeWidth={strokeWidth}
                    className="transition-all duration-200"
                  />
                  {/* Character name label */}
                  <text
                    x={node.x}
                    y={node.y + radius + 16}
                    textAnchor="middle"
                    className={`text-[11px] fill-zinc-300 font-semibold pointer-events-none ${
                      isSelected || isHighlighted ? 'font-bold' : ''
                    }`}
                    style={{ textShadow: '0 0 4px rgba(0,0,0,0.9)' }}
                  >
                    {node.character.name.length > 14
                      ? node.character.name.substring(0, 14) + '...'
                      : node.character.name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Enhanced Tooltip */}
      {tooltipData && (
        <div
          className="absolute z-20 bg-zinc-800/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 shadow-2xl pointer-events-none"
          style={{
            left: `${(tooltipData.x + pan.x) * zoom + 20}px`,
            top: `${(tooltipData.y + pan.y) * zoom + 20}px`,
            maxWidth: '300px',
          }}
        >
          {tooltipData.type === 'node' && tooltipData.node && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-amber-400">{tooltipData.node.name}</div>
              {tooltipData.node.isProtagonist && (
                <div className="text-xs text-yellow-400">Protagonist</div>
              )}
              {tooltipData.node.status && (
                <div className="text-xs text-zinc-400">Status: {tooltipData.node.status}</div>
              )}
              {tooltipData.node.currentCultivation && (
                <div className="text-xs text-zinc-400">Cultivation: {tooltipData.node.currentCultivation}</div>
              )}
              {tooltipData.node.relationships && tooltipData.node.relationships.length > 0 && (
                <div className="text-xs text-zinc-400">
                  {tooltipData.node.relationships.length} relationship{tooltipData.node.relationships.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
          
          {tooltipData.type === 'link' && tooltipData.link && (
            <div className="space-y-2">
              <div className="text-sm font-bold text-amber-400">
                {tooltipData.link.source.name} ↔ {tooltipData.link.target.name}
              </div>
              <div className="text-xs text-zinc-300 font-semibold">
                {tooltipData.link.relationship.type}
              </div>
              {tooltipData.link.relationship.history && (
                <div className="text-xs text-zinc-400 italic">
                  {tooltipData.link.relationship.history.length > 100
                    ? tooltipData.link.relationship.history.substring(0, 100) + '...'
                    : tooltipData.link.relationship.history}
                </div>
              )}
              {tooltipData.link.relationship.impact && (
                <div className="text-xs text-zinc-400">
                  Impact: {tooltipData.link.relationship.impact.length > 60
                    ? tooltipData.link.relationship.impact.substring(0, 60) + '...'
                    : tooltipData.link.relationship.impact}
                </div>
              )}
              <div className="text-xs text-zinc-500">
                Strength: {Math.round(tooltipData.link.strength)}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-zinc-800/90 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 space-y-2">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Legend</div>
        <div className="flex flex-wrap gap-3 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-zinc-300">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-zinc-300">Protagonist</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
            <span className="text-zinc-300">Character</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-red-500"></div>
            <span className="text-zinc-300">Enemy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-green-500"></div>
            <span className="text-zinc-300">Ally</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 bg-blue-500"></div>
            <span className="text-zinc-300">Mentor</span>
          </div>
        </div>
        <div className="text-[9px] text-zinc-500 mt-2">
          Click & drag to pan | Scroll to zoom | Drag nodes to reposition
        </div>
      </div>
    </div>
  );
};