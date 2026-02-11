import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

export const getLayoutedElements = (
	nodes: Node[],
	edges: Edge[],
	direction: "TB" | "LR" = "TB",
): { nodes: Node[]; edges: Edge[] } => {
	const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

	g.setGraph({
		rankdir: direction,
		nodesep: 60,
		ranksep: 80,
		marginx: 20,
		marginy: 20,
	});

	for (const node of nodes) {
		g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
	}

	for (const edge of edges) {
		g.setEdge(edge.source, edge.target);
	}

	Dagre.layout(g);

	const layoutedNodes = nodes.map((node) => {
		const dagreNode = g.node(node.id);
		return {
			...node,
			position: {
				x: dagreNode.x - NODE_WIDTH / 2,
				y: dagreNode.y - NODE_HEIGHT / 2,
			},
		};
	});

	return { nodes: layoutedNodes, edges };
};
