import type { findEnvironmentById } from "@dokploy/server";
import {
	type TopologyNode,
	detectDependencies,
} from "@dokploy/server/utils/topology/detect-dependencies";
import {
	Background,
	Controls,
	type Edge,
	MiniMap,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FolderInput } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo } from "react";
import { getLayoutedElements } from "./layout";
import { ServiceNode, type ServiceNodeData } from "./service-node";

type Environment = Awaited<ReturnType<typeof findEnvironmentById>>;

interface TopologyViewProps {
	environment: Environment;
	projectId: string;
	environmentId: string;
}

const nodeTypes = {
	service: ServiceNode,
};

export const TopologyView = ({
	environment,
	projectId,
	environmentId,
}: TopologyViewProps) => {
	const router = useRouter();
	const { resolvedTheme } = useTheme();

	const { topologyNodes, envVarsMap, composeFiles } = useMemo(() => {
		const nodes: TopologyNode[] = [];
		const envMap: Record<string, string> = {};
		const compFiles: Record<string, string> = {};

		for (const app of environment.applications || []) {
			nodes.push({
				id: app.applicationId,
				appName: app.appName,
				name: app.name,
				type: "application",
				status: app.applicationStatus,
			});
			if (app.env) envMap[app.applicationId] = app.env;
		}

		for (const db of environment.postgres || []) {
			nodes.push({
				id: db.postgresId,
				appName: db.appName,
				name: db.name,
				type: "postgres",
				status: db.applicationStatus,
			});
			if (db.env) envMap[db.postgresId] = db.env;
		}

		for (const db of environment.mysql || []) {
			nodes.push({
				id: db.mysqlId,
				appName: db.appName,
				name: db.name,
				type: "mysql",
				status: db.applicationStatus,
			});
			if (db.env) envMap[db.mysqlId] = db.env;
		}

		for (const db of environment.mariadb || []) {
			nodes.push({
				id: db.mariadbId,
				appName: db.appName,
				name: db.name,
				type: "mariadb",
				status: db.applicationStatus,
			});
			if (db.env) envMap[db.mariadbId] = db.env;
		}

		for (const db of environment.mongo || []) {
			nodes.push({
				id: db.mongoId,
				appName: db.appName,
				name: db.name,
				type: "mongo",
				status: db.applicationStatus,
			});
			if (db.env) envMap[db.mongoId] = db.env;
		}

		for (const db of environment.redis || []) {
			nodes.push({
				id: db.redisId,
				appName: db.appName,
				name: db.name,
				type: "redis",
				status: db.applicationStatus,
			});
			if (db.env) envMap[db.redisId] = db.env;
		}

		for (const comp of environment.compose || []) {
			nodes.push({
				id: comp.composeId,
				appName: comp.appName,
				name: comp.name,
				type: "compose",
				status: comp.composeStatus,
			});
			if (comp.env) envMap[comp.composeId] = comp.env;
			if (comp.composeFile) compFiles[comp.composeId] = comp.composeFile;
		}

		return { topologyNodes: nodes, envVarsMap: envMap, composeFiles: compFiles };
	}, [environment]);

	const { initialNodes, initialEdges } = useMemo(() => {
		const topology = detectDependencies(
			topologyNodes,
			envVarsMap,
			composeFiles,
		);

		const rfNodes: Node[] = topology.nodes.map((node) => ({
			id: node.id,
			type: "service",
			position: { x: 0, y: 0 },
			data: {
				label: node.name,
				serviceType: node.type,
				status: node.status,
				serviceId: node.id,
			} satisfies ServiceNodeData,
		}));

		const rfEdges: Edge[] = topology.edges.map((edge, idx) => ({
			id: `e-${edge.source}-${edge.target}-${idx}`,
			source: edge.source,
			target: edge.target,
			label: edge.label,
			animated: true,
			style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
			labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
			labelBgStyle: { fill: "hsl(var(--card))" },
			labelBgPadding: [6, 3] as [number, number],
			labelBgBorderRadius: 4,
		}));

		const layouted = getLayoutedElements(rfNodes, rfEdges);
		return { initialNodes: layouted.nodes, initialEdges: layouted.edges };
	}, [topologyNodes, envVarsMap, composeFiles]);

	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	useEffect(() => {
		setNodes(initialNodes);
		setEdges(initialEdges);
	}, [initialNodes, initialEdges, setNodes, setEdges]);

	const onNodeClick = useCallback(
		(_: React.MouseEvent, node: Node) => {
			const data = node.data as ServiceNodeData;
			router.push(
				`/dashboard/project/${projectId}/environment/${environmentId}/services/${data.serviceType}/${data.serviceId}`,
			);
		},
		[router, projectId, environmentId],
	);

	if (topologyNodes.length === 0) {
		return (
			<div className="flex h-[60vh] w-full flex-col items-center justify-center">
				<FolderInput className="size-8 self-center text-muted-foreground" />
				<span className="text-center font-medium text-muted-foreground">
					No services added yet. Click on Create Service.
				</span>
			</div>
		);
	}

	return (
		<div className="h-[65vh] w-full rounded-lg border bg-background">
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onNodeClick={onNodeClick}
				nodeTypes={nodeTypes}
				colorMode={resolvedTheme === "dark" ? "dark" : "light"}
				fitView
				fitViewOptions={{ padding: 0.3 }}
				minZoom={0.3}
				maxZoom={2}
				proOptions={{ hideAttribution: true }}
			>
				<Background gap={16} size={1} />
				<Controls showInteractive={false} />
				<MiniMap
					nodeStrokeWidth={3}
					zoomable
					pannable
					className="!bg-card !border-border"
				/>
			</ReactFlow>
		</div>
	);
};
